import type {size} from 'sentry/utils/theme/scraps/tokens/size';

/**
 * Font size constraint for body typography.
 */
export type TextSize = SizeRange<'xs', '2xl'>;

/**
 * Font size constraint for heading typography.
 */
export type HeadingSize = SizeRange<'xs', '4xl'>;

/**
 * Responsive viewport breakpoint size constraint (`@media`).
 */
export type BreakpointSize = SizeRange<'2xs', '2xl'>;

/**
 * Container query breakpoint size constraint (`@container`). A dedicated scale,
 * separate from the viewport `BreakpointSize`, with `zero` as the always-applied
 * base. Derived from the generated `size.container` token so it can't drift from it.
 * See `theme.container`.
 */
export type ContainerBreakpointSize = keyof (typeof size)['container'];

/**
 * Spacing size constraint for margin, padding, and gap.
 */
export type SpaceSize = SizeRange<'0', '3xl'>;

/**
 * Border radius size constraint.
 */
export type RadiusSize = SizeRange<'0', '2xl'> | 'full';

/**
 * Animation easing curve preset.
 */
export type MotionEasing = 'smooth' | 'snap' | 'enter' | 'exit' | 'spring';

/**
 * Animation duration preset.
 */
export type MotionDuration = 'fast' | 'moderate' | 'slow';

// Theme Variants

/**
 * Background surface level for layered UI elements.
 */
export type SurfaceVariant = 'primary' | 'secondary' | 'tertiary';

/**
 * Semantic color variant for conveying meaning through color.
 */
type SemanticVariant =
  | 'accent'
  | 'danger'
  | 'neutral'
  | 'promotion'
  | 'success'
  | 'warning';

/**
 * Content/text color variant.
 */
export type ContentVariant =
  | Exclude<SemanticVariant, 'neutral'>
  | 'primary'
  | 'secondary';

/**
 * Graphics/icon color variant.
 */
export type GraphicsVariant = SemanticVariant;

/**
 * Border color variant.
 */
export type BorderVariant =
  | Exclude<SemanticVariant, 'neutral'>
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'none';

// Component Variants (should be moved locally, aligned to SemanticVariant)

/**
 * Icon size constraint.
 */
export type IconSize = SizeRange<'xs', '2xl'>;

/**
 * Form element size constraint.
 *
 * Unless you are implementing a new component in the `@sentry/scraps`
 * directory, use `ComponentProps['size']` instead.
 */
export type FormSize = SizeRange<'xs', 'md'>;

/**
 * Tag color scheme.
 */
export type TagVariant =
  | 'muted'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'promotion';

/**
 * Alert/status color scheme.
 */
export type AlertVariant = 'muted' | 'info' | 'warning' | 'success' | 'danger';

// Internal types

type SizeKeys = readonly ['0', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
type Size = SizeKeys[number];

// Extracts a contiguous range of keys from the size scale
type ExtractRange<
  T extends readonly string[],
  Start extends string,
  End extends string,
  Collecting extends boolean = false,
  Acc extends string = never,
> = T extends readonly [infer Head extends string, ...infer Tail extends string[]]
  ? Head extends Start
    ? Head extends End
      ? Acc | Head
      : ExtractRange<Tail, Start, End, true, Acc | Head>
    : Collecting extends true
      ? Head extends End
        ? Acc | Head
        : ExtractRange<Tail, Start, End, true, Acc | Head>
      : ExtractRange<Tail, Start, End, false, Acc>
  : Acc;

type SizeRange<Start extends Size, End extends Size> = ExtractRange<SizeKeys, Start, End>;
