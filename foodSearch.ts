// Food lookup using Open Food Facts (open, crowd-sourced database of millions of products, no API key needed).
// Nutrition values are per 100 g and get scaled to the amount the user enters.
export type Per100 = { calories: number; protein: number; carbs: number; fat: number };
export type FoodResult = { id: string; name: string; brand: string; per100: Per100; servingGrams: number | null; grade: string | null };
const GRADES: Record<string, string> = { a: 'Very healthy', b: 'Healthy', c: 'OK in moderation', d: 'Eat sometimes', e: 'Eat sparingly' };
// Nutri-Score letter (a-e) from Open Food Facts, turned into a plain-English label
export const gradeInfo = (g?: string | null) => (g && GRADES[g] ? { label: GRADES[g] } : null);

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProduct(p: any): FoodResult | null {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n['energy_100g'] ?? n['energy-kj_100g']);
    if (kj !== null) kcal = kj / 4.184;
  }
  const name = String(p.product_name ?? '').trim();
  if (!name || kcal === null) return null; // skip entries without usable nutrition data
  const brandRaw = Array.isArray(p.brands) ? p.brands[0] : String(p.brands ?? '').split(',')[0];
  const serving = num(p.serving_quantity);
  const grade = String(p.nutriscore_grade ?? '').toLowerCase();
  return {
    id: String(p.code ?? name),
    name,
    brand: String(brandRaw ?? '').trim(),
    per100: {
      calories: Math.max(0, kcal),
      protein: Math.max(0, num(n['proteins_100g']) ?? 0),
      carbs: Math.max(0, num(n['carbohydrates_100g']) ?? 0),
      fat: Math.max(0, num(n['fat_100g']) ?? 0),
    },
    servingGrams: serving && serving > 0 && serving <= 2000 ? serving : null,
    grade: /^[a-e]$/.test(grade) ? grade : null,
  };
}

const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,nutriscore_grade';
const clean = (list: unknown[]) => list.map(mapProduct).filter((f): f is FoodResult => f !== null);

export async function searchFoods(query: string, signal: AbortSignal): Promise<FoodResult[]> {
  const q = encodeURIComponent(query);
  try {
    const r = await fetch(`https://search.openfoodfacts.org/search?q=${q}&page_size=20&fields=${FIELDS}&langs=en`, { signal });
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    const list = clean(Array.isArray(data.hits) ? data.hits : []);
    if (list.length) return list;
  } catch (e) {
    if (signal.aborted) throw e;
  }
  // Fallback: the older keyword search endpoint
  const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`, { signal });
  if (!r.ok) throw new Error('Food search is unavailable right now.');
  const data = await r.json();
  return clean(Array.isArray(data.products) ? data.products : []);
}

export function scalePer100(base: Per100, grams: number) {
  const f = grams / 100;
  const r1 = (x: number) => String(Math.round(x * f * 10) / 10);
  return { calories: String(Math.round(base.calories * f)), protein: r1(base.protein), carbs: r1(base.carbs), fat: r1(base.fat) };
}
