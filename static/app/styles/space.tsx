const SPACES = {
  0.25: '2px',
  0.5: '4px',
  0.75: '6px',
  1: '8px',
  1.5: '12px',
  2: '16px',
  3: '20px',
  4: '30px',
} as const;

export type ValidSize = keyof typeof SPACES;

/**
 * @deprecated prefer `theme.space['2xs']`
 */
function space(size: 0.25): (typeof SPACES)[0.25];
/**
 * @deprecated prefer `theme.space.xs`
 */
function space(size: 0.5): (typeof SPACES)[0.5];
/**
 * @deprecated prefer `theme.space.sm`
 */
function space(size: 0.75): (typeof SPACES)[0.75];
/**
 * @deprecated prefer `theme.space.md`
 */
function space(size: 1): (typeof SPACES)[1];
/**
 * @deprecated prefer `theme.space.lg`
 */
function space(size: 1.5): (typeof SPACES)[1.5];
/**
 * @deprecated prefer `theme.space.xl`
 */
function space(size: 2): (typeof SPACES)[2];
/**
 * @deprecated prefer `theme.space['2xl']`
 */
function space(size: 3): (typeof SPACES)[3];
/**
 * @deprecated prefer `theme.space['3xl']`
 */
function space(size: 4): (typeof SPACES)[4];
/**
 * @deprecated replace with `theme.space.*`
 * | before | after  | value                |
 * | ------ | ------ | -------------------- |
 * |        | `none` | `0px` (new!)         |
 * | `0.25` | `2xs`  | `2px`                |
 * | `0.5`  | `xs`   | `4px`                |
 * | `0.75` | `sm`   | `6px`                |
 * | `1`    | `md`   | `8px`                |
 * | `1.5`  | `lg`   | `12px`               |
 * | `2`    | `xl`   | `16px`               |
 * | `3`    | `2xl`  | `24px` (from `20px`) |
 * | `4`    | `3xl`  | `32px` (from `30px`) |
 */
function space<S extends ValidSize>(size: S): (typeof SPACES)[S] {
  return SPACES[size];
}

export {space};
