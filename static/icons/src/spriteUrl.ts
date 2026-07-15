/**
 * Resolved as a hashed static asset by Vite and Rspack. Kept in its own
 * module so test environments without `import.meta.url` asset support can
 * mock it in one place.
 */
export const spriteUrl = new URL('sprite.generated.svg', import.meta.url).href;
