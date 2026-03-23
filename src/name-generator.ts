import { stemExists } from './db.js';

const ACCENT_MAP: Record<string, string> = {
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
  'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
  'ñ': 'n', 'ç': 'c',
};

function removeAccents(str: string): string {
  return str.replace(/[áéíóúäëïöüñç]/g, char => ACCENT_MAP[char] || char);
}

function sanitizeSlug(raw: string): string {
  let slug = raw.toLowerCase().trim();
  slug = removeAccents(slug);
  // Replace spaces and underscores with hyphens
  slug = slug.replace(/[\s_]+/g, '-');
  // Remove anything that's not alphanumeric or hyphen
  slug = slug.replace(/[^a-z0-9-]/g, '');
  // Collapse multiple hyphens
  slug = slug.replace(/-+/g, '-');
  // Trim hyphens from start/end
  slug = slug.replace(/^-+|-+$/g, '');
  // Truncate to 60 chars at a word boundary
  if (slug.length > 60) {
    slug = slug.substring(0, 60);
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > 30) {
      slug = slug.substring(0, lastHyphen);
    }
  }
  return slug || 'imagen-sin-nombre';
}

export function generateUniqueSlug(rawDescription: string, originalStem: string): string {
  let baseStem = sanitizeSlug(rawDescription);

  // If the AI returned garbage, use a fallback
  if (baseStem === 'imagen-sin-nombre' || baseStem.length < 3) {
    baseStem = `imagen-sin-descripcion-${sanitizeSlug(originalStem)}`;
  }

  // Deduplicate against existing entries in DB
  let stem = baseStem;
  let counter = 1;
  while (stemExists(stem)) {
    counter++;
    stem = `${baseStem}-${counter}`;
  }

  return stem;
}
