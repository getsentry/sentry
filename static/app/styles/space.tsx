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

/** @deprecated use `import type { Space } from 'sentry/components/core/layout/space'` */
export type ValidSize = keyof typeof SPACES;

/** @deprecated use equivalent `theme.space.*` value */
function space<S extends 0.25>(size: S): (typeof SPACES)[S];
/** @deprecated use `theme.space.xs` */
function space<S extends 0.5>(size: S): (typeof SPACES)[S];
/** @deprecated use `theme.space.sm` */
function space<S extends 0.75>(size: S): (typeof SPACES)[S];
/** @deprecated use `theme.space.md` */
function space<S extends 1>(size: S): (typeof SPACES)[S];
/** @deprecated use `theme.space.lg` */
function space<S extends 1.5>(size: S): (typeof SPACES)[S];
/** @deprecated use `theme.space.xl` */
function space<S extends 2>(size: S): (typeof SPACES)[S];
/** @deprecated use `theme.space['2xl']` */
function space<S extends 3>(size: S): (typeof SPACES)[S];
/** @deprecated use `theme.space['3xl']` */
function space<S extends 4>(size: S): (typeof SPACES)[S];
/** @deprecated use equivalent `theme.space.*` value */
function space<S extends ValidSize>(size: S): (typeof SPACES)[S] {
  return SPACES[size];
}

export {space};
