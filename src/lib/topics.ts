import type { PlanetId } from "@/lib/astro";

/**
 * What the question is about. Each topic names the house of the quesited —
 * the thing asked about — so the asker never has to know the house system.
 */

export type Topic = {
  id: string;
  title: string;
  text: string;
  house: number;
  /** The planet that signifies the matter by nature, read beside the house ruler. */
  natural?: PlanetId;
};

export type Category = { id: string; title: string; intro: string; topics: Topic[] };

export const HOUSE_MEANINGS: Record<number, string> = {
  1: "вы сами, тело, начинания",
  2: "деньги, имущество, движимые вещи",
  3: "братья и сёстры, соседи, письма, короткие поездки",
  4: "дом, недвижимость, родители, итог дела",
  5: "романы, дети, удовольствия",
  6: "болезни, работа по найму, подчинённые",
  7: "партнёр, супруг(а), другая сторона, противник",
  8: "чужие деньги, долги, наследство",
  9: "дальние поездки, учёба, заграница, вера",
  10: "карьера, начальство, репутация",
  11: "друзья, надежды, покровители",
  12: "тайные враги, изоляция, то, что скрыто",
};

export const CATEGORIES: Category[] = [
  {
    id: "love",
    title: "Отношения и любовь",
    intro: "Партнёр — VII дом, роман — V, дружба — XI. Если вопрос о конкретном человеке, с которым уже есть история, выбирайте его.",
    topics: [
      { id: "partner", title: "Партнёр или супруг — что будет с отношениями", text: "Чувства, перспективы, расставание, предложение, брак — о нынешнем или возможном партнёре.", house: 7, natural: "venus" },
      { id: "ex", title: "Бывший — вернётся ли", text: "Можно ли восстановить отношения, вернётся ли он или она. Бывший партнёр — тоже VII дом.", house: 7, natural: "venus" },
      { id: "message", title: "Напишет ли, выйдет ли на связь", text: "Позвонит ли, объявится ли первым. Человек — VII дом, а весточку показывает Меркурий.", house: 7, natural: "mercury" },
      { id: "romance", title: "Роман — начнётся ли", text: "Симпатия, флирт, начало романа. Влечение и удовольствие — V дом.", house: 5, natural: "venus" },
      { id: "friend", title: "Дружба — помиримся ли", text: "Ссора с другом или подругой: наладится ли, сохранится ли дружба.", house: 11 },
    ],
  },
  {
    id: "work",
    title: "Работа и карьера",
    intro: "Должность и карьера — X дом, договоры и другая сторона сделки — VII.",
    topics: [
      { id: "job", title: "Получу ли работу", text: "Собеседование, отклик на вакансию, предложение о работе.", house: 10, natural: "sun" },
      { id: "career", title: "Повышение, рост в карьере", text: "Новая должность, признание, продвижение.", house: 10, natural: "sun" },
      { id: "fire", title: "Сохраню ли место", text: "Угроза увольнения, сокращение, конфликт с руководством.", house: 10 },
      { id: "exam", title: "Сдам ли экзамен", text: "Экзамен, защита, сертификация — успех дела читается по X дому.", house: 10 },
      { id: "deal", title: "Сделка, договор, переговоры", text: "Подпишем ли, договоримся ли. Другая сторона — VII дом.", house: 7, natural: "mercury" },
    ],
  },
  {
    id: "money",
    title: "Деньги и имущество",
    intro: "Ваши деньги и вещи — II дом, чужие деньги и долги — VIII, недвижимость — IV.",
    topics: [
      { id: "income", title: "Будут ли деньги", text: "Доход, прибыль, финансовое положение.", house: 2, natural: "jupiter" },
      { id: "lost", title: "Найдётся ли пропажа", text: "Потерянная вещь — II дом. Луна — естественный показатель пропавшего.", house: 2, natural: "moon" },
      { id: "debt", title: "Вернут ли долг", text: "Займ, долг, деньги от другого человека — VIII дом.", house: 8 },
      { id: "inheritance", title: "Наследство", text: "Получу ли наследство, как решится вопрос с ним.", house: 8 },
      { id: "property", title: "Недвижимость — купить или продать", text: "Квартира, дом, земля: состоится ли сделка.", house: 4 },
    ],
  },
  {
    id: "move",
    title: "Переезд и поездки",
    intro: "Дом — IV, короткая поездка — III, дальняя дорога и заграница — IX.",
    topics: [
      { id: "local_move", title: "Переезд, смена жилья", text: "Стоит ли переезжать, получится ли сменить квартиру.", house: 4 },
      { id: "emigration", title: "Эмиграция", text: "Переезд в другую страну, жизнь за границей.", house: 9 },
      { id: "short_trip", title: "Короткая поездка", text: "Поездка в соседний город, командировка на несколько дней.", house: 3 },
      { id: "long_trip", title: "Дальнее путешествие", text: "Поездка за границу или далеко от дома.", house: 9 },
    ],
  },
];

export function findTopic(category: string, topic: string): { category: Category; topic: Topic } | null {
  const c = CATEGORIES.find((x) => x.id === category);
  const t = c?.topics.find((x) => x.id === topic);
  return c && t ? { category: c, topic: t } : null;
}
