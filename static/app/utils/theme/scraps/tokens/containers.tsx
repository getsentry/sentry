// Container query breakpoints — the dedicated scale for `@container` queries,
// kept separate from the viewport `breakpoints` scale (see tokens/size.tsx).
// Bare responsive keys (e.g. `{md: …}`) resolve against these; `screen:`-prefixed
// keys resolve against viewport `breakpoints`.
export const containers = {
  zero: '0px',
  '3xs': '320px',
  '2xs': '384px',
  xs: '448px',
  sm: '512px',
  md: '576px',
  lg: '640px',
  xl: '768px',
  '2xl': '896px',
  '3xl': '1024px',
  '4xl': '1152px',
  '5xl': '1280px',
};
