# Детальный план реализации ИИ-системы контента для сети ресторанов

> **Контекст:** 10 заведений, каждое со своим управляющим и SMM-специалистом.
> **Стек:** Supabase (БД + Auth + Storage) · Next.js 15 (веб-кабинет) · n8n (воркеры) · OpenRouter (LLM) · Nano Banana (фото) · SeeDance (видео) · iiko API · Telegram.
> **Подход:** строим на одном заведении до полного цикла, потом масштабируем.

---

## Этап 0. Подготовка инфраструктуры (3–5 дней)

Цель: всё окружение готово, есть один пилотный ресторан для отладки.

### 0.1. Аккаунты и сервисы
- Создать проект в Supabase (Pro tier, не Free — нужен pgvector и приличный storage)
- Завести OpenRouter аккаунт, пополнить $50 на старт
- Получить доступы: iiko Cloud API (логин/пароль API-пользователя), iikoServer API (если используется локальный сервер)
- Получить API-ключ к OpenWeatherMap (или Open-Meteo — он бесплатный)
- Создать Telegram-бота через @BotFather, сохранить токен
- Подготовить тестовый Telegram-канал для пилотного ресторана
- n8n: либо self-hosted на VPS (Hetzner CX22, ~5€/мес), либо n8n Cloud

### 0.2. Выбор пилотного заведения
- Выбрать **одно** заведение из 10 для отладки. Рекомендую то, где:
  - есть активный управляющий, готовый давать обратную связь
  - есть SMM, который готов экспериментировать
  - стабильная работа iiko, не «иногда забываем пробить»
- Все следующие этапы делаются ТОЛЬКО для этого ресторана до Этапа 8

### 0.3. Структура репозиториев
```
content-ai/
├── apps/web/           # Next.js приложение
├── packages/db/        # SQL-миграции, типы
├── packages/prompts/   # Все промпты агентов (версионируемые!)
├── n8n-workflows/      # Экспорты workflow в JSON, в git
└── docs/               # Описание контрактов между агентами
```

---

## Этап 1. Фундамент данных (1–2 недели)

Цель: схема БД, заполненная база знаний по пилотному ресторану, ручной ввод через Supabase Studio.

### 1.1. Схема Postgres (миграция 001)

**Основные таблицы:**

```sql
-- Заведения
restaurants (
  id uuid PK,
  slug text UNIQUE,           -- 'gastrodvor-yalta'
  name text,
  city text,
  timezone text,
  iiko_org_id text,           -- ID организации в iiko
  telegram_channel_id text,
  monthly_video_budget int,   -- лимит SeeDance в месяц (штук)
  monthly_image_budget int,
  is_active boolean,
  created_at timestamptz
)

-- Пользователи системы (расширение auth.users)
profiles (
  id uuid PK REFERENCES auth.users,
  role text,                  -- 'admin' | 'manager' | 'smm'
  full_name text,
  telegram_user_id text,      -- для уведомлений
  created_at timestamptz
)

-- Связь пользователей с заведениями (мульти-тенантность)
restaurant_members (
  restaurant_id uuid FK,
  profile_id uuid FK,
  role text,                  -- 'manager' | 'smm' | 'viewer'
  PRIMARY KEY (restaurant_id, profile_id)
)
```

**Бренд и знания:**

```sql
brand_guidelines (
  id uuid PK,
  restaurant_id uuid FK,
  section text,               -- 'positioning' | 'tone_of_voice' | 'taboos' | 'visual_style' | 'menu_highlights'
  content text,               -- markdown-блок
  embedding vector(1536),     -- для семантического поиска
  version int,                -- версионирование
  is_active boolean,
  updated_by uuid FK profiles,
  updated_at timestamptz
)

menu_items (
  id uuid PK,
  restaurant_id uuid FK,
  iiko_product_id text,       -- связь с iiko
  name text,
  category text,
  description text,
  price numeric,
  is_seasonal boolean,
  is_hero boolean,            -- "флагман" — пушить чаще
  margin_class text,          -- 'high' | 'medium' | 'low'
  photo_urls text[],
  updated_at timestamptz
)

-- Фотобанк ранее снятого
assets (
  id uuid PK,
  restaurant_id uuid FK,
  storage_path text,          -- путь в Supabase Storage
  type text,                  -- 'photo' | 'video'
  source text,                -- 'shot' | 'generated_nano' | 'generated_seedance'
  tags text[],                -- ['interior', 'dish', 'staff', 'evening']
  description text,           -- что на фото, для поиска
  embedding vector(1536),     -- для поиска похожего
  used_in_post_ids uuid[],
  created_at timestamptz
)
```

**Контент-планы и единицы:**

```sql
content_plans (
  id uuid PK,
  restaurant_id uuid FK,
  period_start date,
  period_end date,            -- 2 недели
  status text,                -- 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'in_production'
  strategist_input jsonb,     -- что подали на вход (бренд, iiko, погода)
  strategist_output jsonb,    -- сырой ответ
  feedback_history jsonb[],   -- история правок
  approved_by uuid FK profiles,
  approved_at timestamptz,
  created_at timestamptz
)

content_items (
  id uuid PK,
  plan_id uuid FK,
  restaurant_id uuid FK,
  scheduled_date date,
  format text,                -- 'post' | 'reel' | 'story'
  topic text,                 -- заголовок темы
  goal text,                  -- 'awareness' | 'promo' | 'engagement'
  status text,                -- 'planned' | 'brief_ready' | 'awaiting_shoot' | 'media_uploaded' | 'media_generated' | 'copy_ready' | 'pending_approval' | 'approved' | 'published' | 'rejected'
  shoot_brief jsonb,          -- ТЗ для SMM от Producer
  raw_media_ids uuid[],       -- ссылки на assets (загруженное SMM)
  generated_media_ids uuid[], -- после Nano Banana / SeeDance
  prompts jsonb,              -- что мы отправили в нейросети
  copy_text text,
  copy_hashtags text[],
  final_telegram_ready jsonb, -- итоговый пакет для постинга
  approval_history jsonb[],
  published_at timestamptz,
  created_at timestamptz
)
```

**Внешние данные и обучение:**

```sql
iiko_snapshots (
  id uuid PK,
  restaurant_id uuid FK,
  snapshot_date date,
  insights text,              -- человекочитаемые выводы для агента
  raw_data jsonb,             -- сырые цифры если надо
  created_at timestamptz
)

weather_forecasts (
  restaurant_id uuid FK,
  forecast_date date,
  conditions text,            -- "солнечно, +28°C, штиль"
  temp_c int,
  precipitation_mm numeric,
  PRIMARY KEY (restaurant_id, forecast_date)
)

-- Очередь задач для n8n
jobs (
  id uuid PK,
  type text,                  -- 'generate_plan' | 'generate_brief' | 'generate_image' | 'generate_video' | 'generate_copy'
  payload jsonb,
  status text,                -- 'pending' | 'running' | 'done' | 'failed'
  retry_count int,
  result jsonb,
  error text,
  created_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
)

-- Обучение системы на правках
feedback_learnings (
  id uuid PK,
  restaurant_id uuid FK,
  source_item_id uuid,
  feedback_text text,         -- что не понравилось
  extracted_rule text,        -- "не используем слово 'вкусно'"
  applied_to_guidelines boolean,
  created_at timestamptz
)
```

### 1.2. RLS-политики (Row Level Security)

Критично для мульти-тенантности. Управляющий заведения А не должен видеть данные заведения Б.

```sql
-- Пример для content_plans
CREATE POLICY "members_see_own_restaurant"
ON content_plans FOR SELECT
USING (
  restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members
    WHERE profile_id = auth.uid()
  )
);
-- Аналогичные политики для всех тенант-таблиц
-- Админ сети видит всё через role='admin' в profiles
```

### 1.3. Заполнение базы знаний для пилотного ресторана

Это самая важная часть. От качества `brand_guidelines` зависит всё. Заполнить вручную через Supabase Studio:

**Раздел `positioning`** (1 блок):
- Кто мы, для кого, чем отличаемся
- Средний чек, ЦА (возраст, доход, повод)
- Главные конкуренты и чем мы лучше

**Раздел `tone_of_voice`** (1 блок):
- Как разговариваем (на «вы»/«ты», формально/дружелюбно)
- Примеры хороших фраз (5–10 штук из ваших старых удачных постов)
- Примеры плохих фраз (что НИКОГДА не пишем)

**Раздел `taboos`** (1 блок):
- Стоп-слова («вкусно», «уютная атмосфера», «команда профессионалов»)
- Запрещённые темы (политика, конкуренты по имени, цены без контекста)
- Эмодзи: какие можно, какие нельзя

**Раздел `visual_style`** (1 блок):
- Цветовая палитра, настроение фото (тёплое/холодное, светлое/тёмное)
- Композиция (крупный план/общий план)
- Что в кадре всегда есть (например, всегда видна посуда из натуральных материалов)
- Что НЕ должно быть в кадре

**Раздел `menu_highlights`** (1 блок):
- Топ-5 блюд, которые надо пушить
- Сезонные предложения сейчас
- Сторителлинг по каждому: откуда продукт, кто шеф, чем особенное

После заполнения — прогоняем через OpenAI embeddings API (text-embedding-3-small, $0.02/1M tokens) и сохраняем эмбеддинги.

### 1.4. Импорт меню из iiko
n8n-воркфлоу `iiko-menu-sync`, разовый запуск:
1. Авторизация в iiko Cloud API
2. GET `/api/1/nomenclature/{org_id}` — получить меню
3. Mapping → таблица `menu_items`
4. Поля `is_hero`, `margin_class` заполняются вручную после импорта

**Чеклист завершения этапа 1:**
- [ ] Все таблицы созданы, миграции в git
- [ ] RLS работает (проверено двумя тестовыми юзерами)
- [ ] brand_guidelines заполнен на 5+ блоков, есть эмбеддинги
- [ ] menu_items импортировано из iiko
- [ ] Можно зайти в Supabase Studio и вручную создать запись в content_plans

---

## Этап 2. Strategist + ручной флоу плана (1–2 недели)

Цель: первый агент работает в n8n, генерит план на 2 недели в БД, ты смотришь и оцениваешь качество.

### 2.1. n8n воркфлоу: подготовка контекста

Workflow `prepare-strategist-context`, на вход `restaurant_id`:

1. **Получить brand_guidelines** — все активные разделы из БД
2. **Получить iiko-инсайты** за последние 14 дней (Этап 6 ещё не сделан — пока заглушка с ручными данными в `iiko_snapshots`)
3. **Получить прогноз погоды** на 14 дней (Open-Meteo, бесплатно)
4. **Получить календарь** — праздники, локальные ивенты (захардкодим JSON-файл с праздниками России и Крыма)
5. **Получить последние 20 опубликованных постов** — чтобы не повторяться
6. Собрать всё в один JSON

### 2.2. Агент Strategist

**Модель:** `anthropic/claude-sonnet-4.5` через OpenRouter
*Обоснование:* плановая работа, нужна стратегия, контекст ~30k токенов. Дешевле опуса, умнее haiku. Раз в 2 недели — копейки.

**System prompt (черновик, ~1500 токенов):**

```
Ты — стратег по контенту для ресторана "{restaurant_name}" в {city}.
Твоя задача — составить контент-план на 14 дней.

ЖЕСТКИЕ ПРАВИЛА:
1. Учитывай tone_of_voice и taboos из brand_guidelines — ничего из запрещённого
2. Каждый день: 1 пост + 1–3 сторис. Рилс — 2 раза в неделю.
3. Распределение тем: 40% еда/меню, 20% атмосфера/интерьер, 20% люди (команда, гости),
   10% сторителлинг (история, шеф, продукты), 10% акции/события
4. Учитывай погоду: жаркие дни → веранда, холодные напитки; дождливые → уют, горячее
5. Учитывай iiko-инсайты: пушь то, что заканчивается; убирай из плана то, что закончилось
6. Учитывай праздники из календаря
7. Не повторяй темы из истории последних 20 постов

ВЫВОД — строго JSON по схеме:
{
  "plan_summary": "краткое описание стратегии плана в 2-3 предложениях",
  "items": [
    {
      "date": "2026-05-15",
      "format": "post" | "reel" | "story",
      "topic": "Лосось по-средиземноморски",
      "goal": "promo" | "awareness" | "engagement",
      "rationale": "почему именно это именно в этот день (учёт погоды/праздника/иiko)",
      "key_message": "главная мысль, которую читатель должен унести",
      "suggested_visual": "что должно быть на фото/видео в одном предложении"
    }
  ]
}

Никакого текста до или после JSON.
```

**User prompt** — собранный JSON-контекст из 2.1.

### 2.3. Сохранение плана и проверка качества
- Результат → `content_plans.strategist_output`
- Из `items[]` создаются записи в `content_items` со статусом `planned`
- Ты вручную просматриваешь в Supabase Studio: адекватный ли план, попадает ли в бренд, нет ли табу
- Если плохо — итерируешь промпт, перегенеришь

### 2.4. Что мерить
- Сколько раз пришлось править промпт до приемлемого результата
- Сколько пунктов плана из 14 ты лично одобрил бы без правок
- Время генерации, стоимость одного плана

**Чеклист завершения этапа 2:**
- [ ] n8n workflow `generate-plan` работает по кнопке
- [ ] Сгенерированный план проходит ручную проверку на 80%+
- [ ] Понятна стоимость одного плана (ориентир: $0.30–0.80)
- [ ] Промпты лежат в git, версионируются

---

## Этап 3. Минимальный веб-кабинет (1–2 недели)

Цель: управляющий может зайти, увидеть план, согласовать или попросить правки. SMM пока не нужен.

### 3.1. Стек и инициализация
- Next.js 15 App Router + TypeScript
- Supabase JS Client + Supabase Auth Helpers
- shadcn/ui + Tailwind (или v0.dev для быстрого старта)
- Vercel для деплоя

### 3.2. Страницы (минимум)
- `/login` — magic link или Google OAuth
- `/` — список заведений, доступных юзеру
- `/r/[slug]/plans` — список планов заведения
- `/r/[slug]/plans/[id]` — детали плана, список items, кнопки действий

### 3.3. Действия на плане
- **«Согласовать план»** — статус → `approved`, items активируются для следующего этапа
- **«Запросить правки»** — текстовое поле → создаётся job типа `regenerate_plan` с feedback в payload
- **«Перегенерить с нуля»** — то же самое, но игнорируя текущий вариант

### 3.4. Действия на отдельном item
- Удалить пункт
- Изменить дату
- Изменить тему руками (минорные правки без перегенерации)

### 3.5. n8n слушает jobs
Workflow `job-processor`, запускается каждую минуту:
1. SELECT * FROM jobs WHERE status='pending' ORDER BY created_at LIMIT 1
2. UPDATE status='running'
3. Switch по `type` → дёрнуть нужный sub-workflow
4. UPDATE status='done'/'failed', записать result/error

При правках Strategist получает дополнительно в контекст: `previous_output` + `user_feedback`. И инструкцию «учти правки, переделай только что не понравилось».

**Чеклист завершения этапа 3:**
- [ ] Управляющий логинится, видит ТОЛЬКО своё заведение
- [ ] Может согласовать или запросить правки
- [ ] Правки доходят до n8n и план перегенеряется
- [ ] Realtime — после перегенерации страница обновляется без F5

---

## Этап 4. Producer (ТЗ для SMM) + загрузка медиа (1 неделя)

Цель: после согласования плана SMM получает по каждому пункту чёткое ТЗ на съёмку и может загружать материал.

### 4.1. Агент Producer

**Модель:** `openai/gpt-5-mini` или `anthropic/claude-haiku-4.5` через OpenRouter
*Обоснование:* ремесленная задача, не нужна большая модель. 100+ ТЗ в месяц — экономим.

**Триггер:** когда `content_plans.status` стал `approved`, для каждого `content_item` запускается job `generate_brief`.

**System prompt:**
```
Ты — продюсер контента для ресторана. Получаешь один пункт контент-плана.
Должен составить чёткое ТЗ для SMM-специалиста, который пойдёт снимать.

ВЫХОД — JSON:
{
  "shoot_type": "photo" | "video" | "mixed",
  "shots": [
    {
      "shot_number": 1,
      "description": "что снимаем",
      "framing": "крупный план" | "средний" | "общий",
      "angle": "сверху" | "сбоку" | "под 45°",
      "lighting": "естественный свет у окна" | "тёплый вечерний" | "..."
      "props": ["что должно быть в кадре"],
      "duration_sec": null | 5,    // для видео
      "format_ratio": "9:16" | "1:1" | "4:5"
    }
  ],
  "needs_ai_generation": true | false,  // нужна ли постобработка через Nano Banana/SeeDance
  "ai_generation_notes": "что доделать ИИ если нужно",
  "estimated_total_shots": 5,
  "shooting_time_estimate_min": 15
}
```

**User prompt:** конкретный `content_item` + краткая выдержка из `visual_style` для этого ресторана.

### 4.2. UI для SMM
Новые страницы:
- `/r/[slug]/shoots` — список item'ов в статусе `brief_ready`, отсортированных по дате
- `/r/[slug]/shoots/[id]` — ТЗ + uploader

Загрузка:
- Drag&drop в Supabase Storage (bucket `raw-uploads/{restaurant_id}/{item_id}/`)
- После загрузки — записи в `assets` с `source='shot'`, в `content_items.raw_media_ids`
- Кнопка «Отправить на обработку» → статус `media_uploaded` → триггер следующего этапа

### 4.3. Авто-теггинг загруженного
Опционально, но полезно: при загрузке фото — мини-пайплайн с vision-моделью (GPT-4o-mini vision) который проставляет теги в `assets.tags`. Облегчит поиск в будущем.

**Чеклист завершения этапа 4:**
- [ ] После approve плана SMM видит ТЗ в своём кабинете
- [ ] ТЗ конкретные, по ним реально можно снимать (проверь с SMM лично!)
- [ ] Upload работает, файлы попадают в Storage и БД
- [ ] Превью загруженных файлов показываются в UI

---

## Этап 5. Prompt Engineer + Copywriter + публикация (2 недели)

Цель: замыкаем цикл от загрузки до готового поста в Telegram.

### 5.1. Агент Prompt Engineer (для Nano Banana)

**Модель:** `anthropic/claude-sonnet-4.5` с vision (GPT-5 mini тоже подойдёт)
*Обоснование:* нужно посмотреть на загруженные фото и решить — оставить как есть или дорабатывать.

**Триггер:** статус `media_uploaded`, job `prepare_media`.

**Логика:**
1. Получает: `shoot_brief`, ссылки на загруженные фото
2. Vision-анализ каждой фотки: что на ней, качество, что не так
3. Решение:
   - Хорошее фото → пропускаем в Copywriter as-is
   - Нужна доработка → промпт для Nano Banana
   - Нужно видео → промпт для SeeDance (если бюджет позволяет)
4. Записывает в `content_items.prompts`

**System prompt (для решения о генерации):**
```
Ты — арт-директор. Получаешь ТЗ, фото от SMM и стиль бренда.
Реши для каждого фото: оставить, доработать через Nano Banana, или создать видео через SeeDance.

ВЫХОД — JSON:
{
  "decisions": [
    {
      "input_asset_id": "uuid",
      "action": "keep" | "enhance" | "animate" | "regenerate",
      "nano_banana_prompt": "...",   // если enhance/regenerate
      "seedance_prompt": "...",      // если animate
      "rationale": "почему"
    }
  ],
  "budget_estimate": {
    "images": 2,
    "videos": 1,
    "estimated_cost_usd": 0.85
  }
}
```

### 5.2. Бюджет-гард
Перед вызовом Nano Banana / SeeDance — проверка:
```
SELECT COUNT(*) FROM content_items
WHERE restaurant_id = ?
  AND date_trunc('month', published_at) = date_trunc('month', NOW())
  AND ... -- посчитать использованные видео
```
Если превышен `monthly_video_budget` → не вызываем, в `prompts` помечаем `skipped: budget`, в логе алерт админу.

### 5.3. Генерация
Этот пайплайн у тебя уже есть из прошлого n8n-проекта — переиспользуй:
- Nano Banana → возвращает URL, скачиваем, кладём в Storage, в `assets` с `source='generated_nano'`
- SeeDance → аналогично, `source='generated_seedance'`
- Записи в `content_items.generated_media_ids`

### 5.4. Агент Copywriter

**Модель:** `anthropic/claude-sonnet-4.5`
*Обоснование:* текст — лицо бренда, на нём не экономим.

**System prompt:**
```
Ты — копирайтер ресторана "{restaurant_name}".
Пишешь пост в Telegram-канал по утверждённому плану.

Учитывай tone_of_voice, taboos, key_message из ТЗ.

Структура поста:
- Хук в первой строке (без кликбейта)
- Основной текст 3-7 предложений
- Призыв к действию (если уместен)
- Хэштеги (3-5)

Длина: 400-800 символов для поста, 80-200 для сторис, 100-300 для рилса.

ВЫХОД — JSON:
{
  "text": "...",
  "hashtags": ["..."],
  "alt_text": "описание медиа для accessibility",
  "tone_check": "какие фразы из tone_of_voice применил",
  "taboo_check": "подтверди, что не использовал запретные слова"
}
```

### 5.5. Финальное согласование
- Статус `pending_approval` → SMM и управляющий видят в кабинете готовый пакет: медиа + текст
- Кнопки: «Опубликовать», «Правки в тексте» (regenerate copy), «Перегенерить медиа», «Отклонить полностью»

### 5.6. Публикация в Telegram
n8n workflow `publish-to-telegram`:
1. Скачивает медиа из Supabase Storage
2. Telegram Bot API: `sendPhoto` / `sendVideo` / `sendMediaGroup` в канал заведения
3. Статус → `published`, `published_at` = NOW()
4. Уведомление управляющему: «Опубликовано»

**Чеклист завершения этапа 5:**
- [ ] Полный цикл от плана до публикации проходит
- [ ] Хотя бы 5 постов вышли в реальный канал
- [ ] Стоимость одного поста посчитана (ориентир: $0.10–0.50 для фото, $1–3 для видео)
- [ ] Управляющий доволен качеством на 70%+

---

## Этап 6. iiko-интеграция (1 неделя)

Цель: данные о продажах и остатках влияют на план.

### 6.1. n8n workflow `iiko-daily-sync`
Запуск каждый день в 6:00 утра для каждого активного ресторана.

1. Авторизация iiko Cloud API (token живёт 1 час, кешируем в Redis или в job-таблице)
2. OLAP v2 запросы:
   - Продажи за последние 7 дней по позициям меню
   - Продажи за последние 30 дней (сравнение)
   - Остатки на складах сейчас
3. Сохранить сырьё в `iiko_snapshots.raw_data`

### 6.2. Агент iiko-аналитик

**Модель:** `anthropic/claude-haiku-4.5`
*Обоснование:* агрегация и выводы, простая задача, дёшево.

**System prompt:**
```
Ты — аналитик ресторана. Получаешь данные о продажах и остатках за неделю.
Превращай цифры в 5-7 коротких выводов на естественном языке для контент-стратега.

ВЫВОДЫ должны помогать стратегу:
- Что хорошо продаётся → пушим больше
- Что плохо продаётся → пробуем пушить или убираем из акцентов
- Что заканчивается на складе → НЕ пушим
- Новые блюда (продаются < 7 дней) → требуют внимания
- Сезонные сигналы

ВЫХОД — markdown-список выводов, который пойдёт в системный промпт Strategist.
```

Результат → `iiko_snapshots.insights`. Strategist при следующей генерации плана подтянет автоматически.

### 6.3. UI: страница инсайтов
`/r/[slug]/insights` — показываем последние выводы + сырые цифры по запросу. Управляющему полезно.

---

## Этап 7. Обратная связь и обучение (1 неделя)

Цель: правки от управляющих не пропадают, а становятся правилами.

### 7.1. Workflow `extract-learning`
Триггер: когда `content_items.approval_history` пополняется новой правкой.

1. Берём текст правки
2. Агент `feedback-extractor` (claude-haiku-4.5):
   ```
   Дан фидбек: "{feedback}"
   Это правило бренда или разовая правка?
   Если правило — сформулируй его в одной строке для добавления в brand_guidelines.
   Если разовая правка — ответь null.
   ```
3. Если правило — создаём запись в `feedback_learnings`
4. **Не применяем автоматически!** В админ-кабинете админ видит «предложенные правила», подтверждает → они добавляются в `brand_guidelines`

### 7.2. Версионирование brand_guidelines
При каждом изменении — новая версия, старая `is_active = false`. История правок видна.

---

## Этап 8. Масштабирование на 10 заведений (2–3 недели)

Цель: всё, что работало для одного, работает для всех.

### 8.1. Онбординг каждого ресторана
Чеклист на каждое заведение (повторить 9 раз):
1. Создать запись в `restaurants`
2. Завести управляющего и SMM в `profiles` + `restaurant_members`
3. **Заполнить brand_guidelines** (вот тут засада: 9 раз вручную писать 5 разделов = неделя работы). Рекомендация: ты как админ садишься с управляющим каждого ресторана на 1 час, заполняете вместе.
4. Импортировать меню из iiko
5. Подключить Telegram-канал
6. Поставить бюджеты на видео/фото
7. Запустить тестовую генерацию плана, проверить с управляющим
8. Дать доступы пользователям

### 8.2. Дашборд админа сети
- Все 10 ресторанов на одной странице
- Сколько постов вышло за неделю в каждом
- Сколько $ потрачено в OpenRouter / Nano Banana / SeeDance в каждом
- Алерты: где не публикуют, где превысили бюджет, где много правок (значит, plan плохой)

### 8.3. Оптимизация
К этому моменту будет видно:
- Какие промпты работают плохо для каких типов заведений
- Где нужны разные модели (кофейне может хватить Haiku, ресторану — Sonnet)
- Где узкие места (например, SMM не успевают снимать → нужно менять расписание)

---

## Сводная таблица агентов и моделей

| Агент | Когда работает | Модель | Примерная стоимость 1 вызова |
|---|---|---|---|
| **Strategist** | раз в 2 недели | claude-sonnet-4.5 | $0.30–0.80 |
| **Producer** | для каждого item | gpt-5-mini или claude-haiku-4.5 | $0.01–0.03 |
| **iiko-аналитик** | ежедневно | claude-haiku-4.5 | $0.01 |
| **Prompt Engineer** | для каждого item с медиа | claude-sonnet-4.5 (vision) | $0.05–0.15 |
| **Copywriter** | для каждого item | claude-sonnet-4.5 | $0.02–0.05 |
| **Feedback Extractor** | при правках | claude-haiku-4.5 | $0.001 |
| Nano Banana | ~5–15 раз/день/ресторан | — | $0.03–0.08/изображение |
| SeeDance | по бюджету | — | $0.50–2.00/видео |

**Ориентир на 1 пост:** $0.20–0.60 без видео, $1.50–3.50 с видео.
**Ориентир на месяц на 10 ресторанов** (~600 постов): $300–800 при умеренном использовании видео.

---

## Принципы, которые сохраняют рассудок

1. **Один ресторан до полного цикла.** Не масштабируй на 10 раньше Этапа 8.
2. **Промпты — это код.** Версионируй в git, не редактируй в n8n UI.
3. **Сначала ручной флоу, потом автоматизация.** Каждый этап сначала проходим вручную через Supabase Studio, потом автоматизируем.
4. **Бюджет-гарды на всё.** Один баг в цикле может разорить за ночь.
5. **Human-in-the-loop — не баг, а фича.** Не убирай чекпоинты «чтобы быстрее». 6 минут согласования спасают от часа исправления опубликованного.
6. **Логируй всё.** Каждый вызов LLM — payload + response + cost в БД. Без этого не отладишь промпты.
7. **brand_guidelines — главный актив.** 80% качества всей системы зависит от того, насколько хорошо заполнен этот раздел.

---

## Что НЕ делать (типовые ошибки)

- Не делать «AI-агентов, которые сами договариваются». Линейный пайплайн с чекпоинтами надёжнее.
- Не пихать всё в один system prompt. Контекст → разные блоки, передаются явно.
- Не давать ИИ право публиковать самому. Только подготовка, публикует человек.
- Не использовать одну модель на всё. Дорогую — только там, где она нужна.
- Не делать кастомный fine-tuning на этом этапе. Хорошие промпты + RAG по brand_guidelines дадут 90% результата за 5% усилий.
- Не строить свой UI с нуля для админки на старте. Supabase Studio + позже простой Next.js достаточно.
