-- Migration 003: Seed data for pilot restaurant
-- !! Run only after creating at least one user via Supabase Auth UI
-- !! Replace user_id and profile_id placeholders with real UUIDs

-- Create pilot restaurant
insert into restaurants (id, slug, name, city, timezone, iiko_org_id, telegram_channel_id, monthly_video_budget, monthly_image_budget)
values (
  'c0a00000-0000-0000-0000-000000000001',
  'pilot-gastrodvor',
  'Гастродвор',
  'Ялта',
  'Europe/Moscow',
  null, -- fill after obtaining iiko org id
  null, -- fill after creating telegram channel
  5,
  30
);

-- !! Replace with real profile_id after user signup
-- insert into restaurant_members (restaurant_id, profile_id, role)
-- values ('c0a00000-0000-0000-0000-000000000001', '<real-profile-uuid>', 'manager');

-- Seed brand_guidelines (empty templates for pilot restaurant)
-- Fill manually via Supabase Studio with real content
insert into brand_guidelines (restaurant_id, section, content, version, is_active) values
('c0a00000-0000-0000-0000-000000000001', 'positioning', '
## Позиционирование бренда

**Кто мы:** Укажите — семейный ресторан / премиум / fast-casual / специалитет.

**Целевая аудитория:**
- Возраст: ___
- Доход: ___
- Повод: ежедневно / выходной / праздник

**Средний чек:** ___ ₽

**Конкуренты и чем мы лучше:**
1. 
2. 
3. 

**УТП (уникальное торговое предложение):** 
', 1, true),

('c0a00000-0000-0000-0000-000000000001', 'tone_of_voice', '
## Тон голоса (Tone of Voice)

**Обращение:** на «ты» / на «вы»

**Стиль:** дружелюбный / формальный / дерзкий / душевный

**Примеры хороших фраз (из наших удачных постов):**
1. 
2. 
3. 
4. 
5. 

**Примеры плохих фраз (что НЕ пишем):**
1. 
2. 
3. 
', 1, true),

('c0a00000-0000-0000-0000-000000000001', 'taboos', '
## Табу и запреты

**Стоп-слова (НЕ использовать):**
- вкусно
- уютная атмосфера
- команда профессионалов
- (дополнить)

**Запрещённые темы:**
- Политика
- Конкуренты по имени
- Цены без контекста (например, «скидка 20%» без обоснования)

**Эмодзи:**
- Можно: 🍽️ 🔥 🍷 🌿
- Нельзя: 🚫 💀 🙈
', 1, true),

('c0a00000-0000-0000-0000-000000000001', 'visual_style', '
## Визуальный стиль

**Цветовая палитра:** описать основные цвета бренда

**Настроение фото:** тёплое / холодное / светлое / тёмное

**Композиция:**
- Предпочтительно: крупный план / средний / общий
- Ракурс: сверху / сбоку / под 45°

**Что всегда в кадре:**
- 

**Что НЕ должно быть в кадре:**
- Мусор, грязная посуда
- Люди без спроса
- (дополнить)
', 1, true),

('c0a00000-0000-0000-0000-000000000001', 'menu_highlights', '
## Флагманские блюда

**Топ-5 блюд для продвижения:**
1. 
2. 
3. 
4. 
5. 

**Сезонные предложения (сейчас):**
- 

**Сторителлинг по блюдам:**
- Откуда продукты
- Кто шеф-повар
- В чём особенность
', 1, true);

-- Seed sample menu items (empty until iiko sync)
-- insert into menu_items (restaurant_id, name, category, description, price, is_hero, margin_class)
-- values ('c0a00000-0000-0000-0000-000000000001', 'Салат Цезарь', 'Салаты', 'Классический цезарь с куриной грудкой', 650, true, 'high');
