// XXX: This is NOT an exhaustive slugify function
// Only forces lowercase and replaces spaces with hyphens
export default function slugify(str) {
  return typeof str === 'string' ? str.toLowerCase().replace(' ', '-') : '';
}
