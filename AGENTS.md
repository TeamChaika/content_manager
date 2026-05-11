# Content AI — AI система контента для сети ресторанов

## Контекст проекта

**Проект:** Hungry Club — доставка еды в Ялте, 16 категорий блюд.  
**Пилот:** 1 ресторан, после масштабирование на 10.  
**Репозиторий:** https://github.com/TeamChaika/content_manager (ветка `chaikaiiko`)  
**Деплой:** Timeweb Cloud Apps → https://contentplan.chaika.team

## Стек
- **БД:** Supabase Cloud (pgvector, RLS, Auth, Storage) — проект `olzodtqyyxiweaoafaos`
- **Веб:** Next.js 15 App Router + TypeScript + Tailwind v4 — `apps/web/`
- **Оркестрация:** n8n (планируется)
- **LLM:** OpenRouter (Claude Sonnet 4.6 для стратега)
- **Генерация:** Nano Banana (фото), SeeDance (видео) — планируется

## Что сделано

### Этап 1 — БД (готово)
- 12 таблиц: restaurants, profiles, restaurant_members, brand_guidelines, menu_items, assets, content_plans, content_items, iiko_snapshots, weather_forecasts, jobs, feedback_learnings
- RLS-политики для мульти-тенантности
- brand_guidelines заполнен (5 разделов: positioning, tone_of_voice, taboos, visual_style, menu_highlights)
- Пилотный ресторан: `c0a00000-0000-0000-0000-000000000001`, slug `hungry-club-yalta`
- Storage buckets: raw-uploads, generated-media, public-assets

### Этап 2 — Strategist (готово)
- System prompt + user template в `packages/prompts/strategist/`
- Календарь праздников РФ в `packages/prompts/calendar/ru-holidays.json`
- n8n воркфлоу JSON'ы в `n8n-workflows/`
- Первый контент-план сгенерирован (11–24 мая 2026, 28 пунктов) → `content_plans` id через `005_insert_first_plan.sql`

### Этап 3 — Веб-кабинет (готово)
- **Auth:** login page (magic link через Supabase), middleware с редиректом
- **Страницы:** список заведений, список планов, детали плана с items
- **Компоненты:** button, badge, input, textarea, plan-card, navbar
- **Функции:** согласование плана, правки, удаление items, перегенерация (план + отдельные пункты)
- **Docker:** `apps/web/Dockerfile` + `docker-compose.yml` на корне (standalone режим)

### Этап 4 — Producer (не начат)
- ТЗ для SMM, загрузка медиа, агент Prompt Engineer

## MCP-серверы
- `timeweb` — деплой через Timeweb Cloud (требуется `$env:TIMEWEB_TOKEN`)
- `context7` — поиск документации

## Последнее состояние
- Веб-кабинет работает локально на localhost:3000
- Пользователь (admin) привязан к пилотному ресторану
- План отображается, items извлекаются из JSON
- Настроен Timeweb MCP для деплоя

## Следующий шаг
1. Задеплоить через Timeweb MCP
2. Перейти к Этапу 4 (Producer — ТЗ для SMM)
