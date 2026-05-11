# n8n Workflows — Stage 2: Strategist

## Overview

Two main workflows:
1. **`prepare-strategist-context`** — gathers all context data for the Strategist
2. **`generate-plan`** — calls OpenRouter LLM and saves the plan

Plus a generic **`job-processor`** that watches the `jobs` table and dispatches work.

---

## Workflow 1: prepare-strategist-context

**Trigger:** Webhook node — receives `{ restaurant_id: "uuid" }`

### Nodes (in order)

#### Node 1: Webhook
- Method: POST
- Path: `/prepare-strategist-context`
- Fields: `restaurant_id` (string, uuid)

#### Node 2: Supabase — Get Brand Guidelines
```
SELECT section, content
FROM brand_guidelines
WHERE restaurant_id = {{ $json.restaurant_id }}
  AND is_active = true
ORDER BY
  CASE section
    WHEN 'positioning' THEN 1
    WHEN 'tone_of_voice' THEN 2
    WHEN 'taboos' THEN 3
    WHEN 'visual_style' THEN 4
    WHEN 'menu_highlights' THEN 5
  END
```

#### Node 3: Supabase — Get Weather Forecast
```
SELECT
  forecast_date::text AS date,
  conditions,
  temp_c,
  precipitation_mm
FROM weather_forecasts
WHERE restaurant_id = {{ $json.restaurant_id }}
  AND forecast_date >= CURRENT_DATE
  AND forecast_date < CURRENT_DATE + INTERVAL '14 days'
ORDER BY forecast_date
```

> **Note:** If table is empty, skip this node or use Open-Meteo API:
> `GET https://api.open-meteo.com/v1/forecast?latitude=44.50&longitude=34.17&daily=temperature_2m_max,precipitation_sum,weathercode&timezone=Europe/Moscow&forecast_days=14`

#### Node 4: Supabase — Get iiko Insights
```
SELECT insights
FROM iiko_snapshots
WHERE restaurant_id = {{ $json.restaurant_id }}
  AND snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY snapshot_date DESC
LIMIT 1
```

> **Note:** If empty — that's fine. The template handles the `null` case.

#### Node 5: Supabase — Get Recent Posts
```
SELECT
  ci.scheduled_date::text AS published_date,
  ci.topic,
  ci.format
FROM content_items ci
WHERE ci.restaurant_id = {{ $json.restaurant_id }}
  AND ci.status = 'published'
ORDER BY ci.scheduled_date DESC
LIMIT 20
```

#### Node 6: Read Calendar File
- Use "Read Binary File" node
- Path: `${{env.HOME}}/content-ai/prompts/calendar/ru-holidays.json`
- Or embed the JSON directly in a Code node

#### Node 7: Code Node — Assemble Context
```javascript
const brandGuidelines = $input.all()[0].json;
const weather = $input.all()[1].json;
const iiko = $input.all()[2].json;
const recentPosts = $input.all()[3].json;
const holidaysRaw = $input.all()[4].json;

// Filter holidays for the 14-day period
const start = new Date();
const end = new Date();
end.setDate(end.getDate() + 14);

const holidays = holidaysRaw
  .filter(h => {
    const parts = h.date.split('-');
    const testDate = new Date(start.getFullYear(), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return testDate >= start && testDate <= end;
  })
  .map(h => ({
    date: `${start.getFullYear()}-${h.date}`,
    name: h.name,
    description: h.description
  }));

return {
  restaurant_id: $input.first().json.restaurant_id,
  restaurant_name: "Hungry Club",
  restaurant_city: "Ялта",
  period_start: start.toISOString().split('T')[0],
  period_end: end.toISOString().split('T')[0],
  brand_guidelines: brandGuidelines,
  weather: weather,
  iiko_insights: iiko[0]?.insights || null,
  holidays: holidays,
  recent_posts: recentPosts,
  user_feedback: null,
  previous_plan: null
};
```

#### Node 8: Set Webhook Response
Return the assembled context JSON.

---

## Workflow 2: generate-plan

**Trigger:** Webhook — receives `{ restaurant_id, context_json }`

### Nodes

#### Node 1: Webhook
- Method: POST
- Path: `/generate-plan`
- Fields: `restaurant_id`, `context_json`

#### Node 2: HTTP Request — OpenRouter
- Method: POST
- URL: `https://openrouter.ai/api/v1/chat/completions`
- Headers:
  ```
  Authorization: Bearer {{ $env.OPENROUTER_API_KEY }}
  Content-Type: application/json
  HTTP-Referer: https://hungry.club
  X-Title: Hungry Club Content AI
  ```
- Body (JSON):
  ```json
  {
    "model": "anthropic/claude-sonnet-4.5",
    "messages": [
      {
        "role": "system",
        "content": "{{ system_prompt }}"
      },
      {
        "role": "user",
        "content": "{{ assembled_user_prompt }}"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 8192,
    "response_format": { "type": "json_object" }
  }
  ```

#### Node 3: Code Node — Parse Response
```javascript
const response = $input.first().json;
const content = response.choices[0].message.content;

// Strip markdown code fences if present
let jsonStr = content;
if (jsonStr.startsWith('```')) {
  jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```/g, '');
}

const plan = JSON.parse(jsonStr);

return {
  ...plan,
  _meta: {
    model: response.model,
    usage: response.usage,
    cost: calculateCost(response.usage)
  }
};

function calculateCost(usage) {
  // Claude Sonnet 4.5: $3/1M input, $15/1M output
  const inputCost = (usage.prompt_tokens / 1000000) * 3;
  const outputCost = (usage.completion_tokens / 1000000) * 15;
  return inputCost + outputCost;
}
```

#### Node 4: Supabase — Create Content Plan
```sql
INSERT INTO content_plans (
  restaurant_id,
  period_start,
  period_end,
  status,
  strategist_input,
  strategist_output
) VALUES (
  '{{ $json.restaurant_id }}',
  '{{ $json.period_start }}',
  '{{ $json.period_end }}',
  'draft',
  '{{ JSON.stringify($json._context) }}'::jsonb,
  '{{ JSON.stringify($json) }}'::jsonb
)
RETURNING id
```

#### Node 5: Supabase — Create Content Items
Loop through `items[]`:
```sql
INSERT INTO content_items (
  plan_id,
  restaurant_id,
  scheduled_date,
  format,
  topic,
  goal,
  status
) VALUES (
  '{{ $json.plan_id }}'::uuid,
  '{{ $json.restaurant_id }}'::uuid,
  '{{ item.date }}'::date,
  '{{ item.format }}',
  '{{ item.topic }}',
  '{{ item.goal }}',
  'planned'
)
```

#### Node 6: Webhook Response
```json
{
  "plan_id": "{{ plan_id }}",
  "items_count": "{{ items.length }}",
  "cost": "{{ _meta.cost }}",
  "tokens_used": "{{ _meta.usage.total_tokens }}"
}
```

---

## Workflow 3: job-processor

**Trigger:** Schedule Trigger — every 60 seconds

### Nodes

#### Node 1: Schedule Trigger
- Interval: 60 seconds

#### Node 2: Supabase — Get Pending Job
```sql
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 1
```

#### Node 3: IF Node — Job Exists?
Check if `$json.id` is not null.

#### Node 4: Supabase — Mark Running
```sql
UPDATE jobs
SET status = 'running', started_at = NOW()
WHERE id = '{{ $json.id }}'::uuid
```

#### Node 5: Switch Node — Dispatch by type
Branch on `$json.type`:
- `generate_plan` → call Webhook `/generate-plan`
- `generate_brief` → call Webhook `/generate-brief`
- `prepare_media` → call Webhook `/prepare-media`
- `generate_copy` → call Webhook `/generate-copy`
- `regenerate_plan` → call Webhook `/generate-plan` (with feedback)

#### Node 6: Supabase — Mark Done/Failed
```sql
UPDATE jobs
SET status = '{{ status }}', result = '{{ result }}'::jsonb, finished_at = NOW()
WHERE id = '{{ $json.id }}'::uuid
```

---

## Manual Run (Testing Without n8n)

For testing the Strategist without n8n, you can run this SQL to create a dummy job:

```sql
INSERT INTO jobs (type, payload, status) VALUES (
  'generate_plan',
  '{"restaurant_id": "c0a00000-0000-0000-0000-000000000001"}',
  'pending'
);
```

Or call the OpenRouter API directly with the system prompt from `packages/prompts/strategist/system.md` and a manually assembled user prompt.

---

## Cost Estimate

| Component | Cost |
|---|---|
| Strategist call (plan) | $0.30–0.80 |
| 1 call per 2 weeks per restaurant | |
| 10 restaurants × 2 calls/month | $6–16/month |
| Open-Meteo weather | Free |
