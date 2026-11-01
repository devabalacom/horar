/**
 * City search for the "where are you" step: name, coordinates and IANA time
 * zone, which the houses and the local time of the question both need.
 *
 * Open-Meteo's geocoder answers from the browser with no key; the short list
 * below covers the obvious cities and keeps the page usable if it is down.
 * TODO: move behind our own backend (GeoNames dump) before the public launch.
 */

export type Place = { label: string; lat: number; lng: number; tz: string };

export const DEFAULT_PLACE: Place = { label: "Москва, Россия", lat: 55.75222, lng: 37.61556, tz: "Europe/Moscow" };

const FALLBACK: Place[] = [
  DEFAULT_PLACE,
  { label: "Санкт-Петербург, Россия", lat: 59.93863, lng: 30.31413, tz: "Europe/Moscow" },
  { label: "Новосибирск, Россия", lat: 55.0415, lng: 82.9346, tz: "Asia/Novosibirsk" },
  { label: "Екатеринбург, Россия", lat: 56.8519, lng: 60.6122, tz: "Asia/Yekaterinburg" },
  { label: "Казань, Россия", lat: 55.78874, lng: 49.12214, tz: "Europe/Moscow" },
  { label: "Краснодар, Россия", lat: 45.04484, lng: 38.97603, tz: "Europe/Moscow" },
  { label: "Самара, Россия", lat: 53.20007, lng: 50.15, tz: "Europe/Samara" },
  { label: "Владивосток, Россия", lat: 43.10562, lng: 131.87353, tz: "Asia/Vladivostok" },
  { label: "Ташкент, Узбекистан", lat: 41.26465, lng: 69.21627, tz: "Asia/Tashkent" },
  { label: "Алматы, Казахстан", lat: 43.25667, lng: 76.92861, tz: "Asia/Almaty" },
  { label: "Минск, Беларусь", lat: 53.9, lng: 27.56667, tz: "Europe/Minsk" },
];

type GeoResult = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  admin1?: string;
};

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const local = FALLBACK.filter((p) => p.label.toLowerCase().startsWith(q.toLowerCase()));
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=ru&format=json`,
      { signal },
    );
    if (!res.ok) return local;
    const data: { results?: GeoResult[] } = await res.json();
    const found = (data.results ?? [])
      .filter((r) => r.timezone)
      .map((r) => ({
        label: [r.name, r.admin1 !== r.name ? r.admin1 : null, r.country].filter(Boolean).join(", "),
        lat: r.latitude,
        lng: r.longitude,
        tz: r.timezone!,
      }));
    return found.length ? found : local;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return local;
  }
}
