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
function space<S extends 0.25>(size: S): (typeof SPACES)[S];
/**
 * @deprecated prefer `theme.space.xs`
 */
function space<S extends 0.5>(size: S): (typeof SPACES)[S];
/**
 * @deprecated prefer `theme.space.sm`
 */
function space<S extends 0.75>(size: S): (typeof SPACES)[S];
/**
 * @deprecated prefer `theme.space.md`
 */
function space<S extends 1>(size: S): (typeof SPACES)[S];
/**
 * @deprecated prefer `theme.space.lg`
 */
function space<S extends 1.5>(size: S): (typeof SPACES)[S];
/**
 * @deprecated prefer `theme.space.xl`
 */
function space<S extends 2>(size: S): (typeof SPACES)[S];
/**
 * @deprecated prefer `theme.space['2xl']`
 */
function space<S extends 3>(size: S): (typeof SPACES)[S];
/**
 * @deprecated prefer `theme.space['3xl']`
 */
function space<S extends 4>(size: S): (typeof SPACES)[S];
/**
 * @deprecated replace with `theme.space.*` value from the
 *
 *
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
function space<S extends ValidSize>(size: S): (typeof SPACES)[S];
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
