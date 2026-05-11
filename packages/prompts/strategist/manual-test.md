# Manual Test: Strategist Without n8n

## Step 1: Seed test weather data (run in Supabase SQL Editor)

```sql
-- Seed 14 days of weather for Yalta (current date + 14)
INSERT INTO weather_forecasts (restaurant_id, forecast_date, conditions, temp_c, precipitation_mm) VALUES
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE,           'солнечно, без осадков', 22, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 1,       'солнечно, лёгкий ветер', 24, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 2,       'облачно, возможен дождь', 18, 3.5),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 3,       'пасмурно, дождь', 16, 8.2),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 4,       'переменная облачность', 20, 1.0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 5,       'солнечно', 26, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 6,       'солнечно, жарко', 28, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 7,       'солнечно', 27, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 8,       'облачно, кратковременный дождь', 21, 2.1),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 9,       'солнечно', 25, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 10,      'солнечно, жарко', 29, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 11,      'переменная облачность', 23, 0.5),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 12,      'солнечно', 24, 0),
('c0a00000-0000-0000-0000-000000000001', CURRENT_DATE + 13,      'солнечно, ветер', 22, 0)
ON CONFLICT (restaurant_id, forecast_date) DO NOTHING;
```

## Step 2: Copy System Prompt

Open `packages/prompts/strategist/system.md` and copy the entire content.

## Step 3: Build User Prompt

Run this SQL to assemble the user prompt context, then copy-paste the result:

```sql
-- Get brand guidelines
SELECT '=== BRAND GUIDELINES ===' as section, '' as content
UNION ALL
SELECT section, content FROM brand_guidelines
WHERE restaurant_id = 'c0a00000-0000-0000-0000-000000000001'
  AND is_active = true
UNION ALL
SELECT '=== WEATHER ===' as section, '' as content
UNION ALL
SELECT forecast_date::text, conditions || ', ' || temp_c || '°C, ' || precipitation_mm || 'mm'
FROM weather_forecasts
WHERE restaurant_id = 'c0a00000-0000-0000-0000-000000000001'
ORDER BY section, content;
```

## Step 4: Call OpenRouter

Go to https://openrouter.ai/playground and:
1. Select model: **Anthropic: Claude Sonnet 4.5** (ID: `anthropic/claude-sonnet-4.5`)
2. Temperature: 0.7
3. Max tokens: 8192
4. Paste System Prompt from Step 2
5. Paste User Prompt from Step 3 (format it as a readable message)
6. Click Send

## Step 5: Evaluate Output

Check:
- [ ] Valid JSON returned
- [ ] 14 days covered
- [ ] 2 reels per week (Tuesday + Friday)
- [ ] Weather accounted for (hot days → cold drinks)
- [ ] No taboo words
- [ ] Each item has rationale
- [ ] Topics don't repeat consecutively

## Step 6: Insert into Supabase (if good)

```sql
INSERT INTO content_plans (
  restaurant_id, period_start, period_end, status,
  strategist_output
) VALUES (
  'c0a00000-0000-0000-0000-000000000001',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '13 days',
  'pending_approval',
  '{ "paste_strategist_json_here" }'::jsonb
);
```
