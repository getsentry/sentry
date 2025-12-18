/**
 * Background surface level for layered UI elements.
 */
export type SurfaceVariant = 'primary' | 'secondary' | 'tertiary';

/**
 * Semantic color variant for conveying meaning through color.
 */
export type SemanticVariant =
  | 'accent'
  | 'danger'
  | 'neutral'
  | 'promotion'
  | 'success'
  | 'warning';

/**
 * Color intensity level for semantic color variants.
 */
export type ColorIntensity = 'moderate' | 'muted' | 'vibrant';

/**
 * Full t-shirt size scale.
 */
export type Size = SizeKeys[number];

/**
 * Icon size constraint.
 */
export type IconSize = SizeRange<'xs', '2xl'>;

/**
 * Font size constraint for typography.
 */
export type FontSize = SizeRange<'xs', '2xl'>;

/**
 * Form element size constraint.
 */
export type FormSize = SizeRange<'xs', 'md'>;

/**
 * Responsive breakpoint size constraint.
 */
export type BreakpointSize = SizeRange<'2xs', '2xl'>;

/**
 * Spacing size constraint for margin, padding, and gap.
 */
export type SpaceSize = SizeRange<'0', '3xl'>;

/**
 * Shadow elevation size constraint.
 */
export type ShadowSize = SizeRange<'sm', 'xl'>;

/**
 * Border radius size constraint.
 */
export type RadiusSize = SizeRange<'0', '2xl'> | 'full';

/**
 * Border width size constraint.
 */
export type BorderSize = SizeRange<'0', '2xl'>;

/**
 * Animation easing curve preset.
 */
export type MotionEasing = 'smooth' | 'snap' | 'enter' | 'exit' | 'spring';

/**
 * Animation duration preset.
 */
export type MotionDuration = 'fast' | 'moderate' | 'slow';

/**
 * Content/text color variant.
 */
export type ContentVariant = 'primary' | 'muted' | Exclude<SemanticVariant, 'neutral'>;

/**
 * Graphics/icon color variant.
 */
export type GraphicsVariant = 'muted' | Exclude<SemanticVariant, 'neutral'>;

/**
 * Border color variant.
 */
export type BorderVariant = 'primary' | 'muted' | Exclude<SemanticVariant, 'neutral'>;

/**
 * Tag color scheme.
 */
export type TagVariant =
  | 'default'
  | 'promotion'
  | 'highlight'
  | 'warning'
  | 'success'
  | 'error'
  | 'info';

/**
 * Alert/status color scheme.
 */
export type AlertVariant = 'muted' | 'info' | 'warning' | 'success' | 'error';

// -----------------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------------

type SizeKeys = readonly [
  '0',
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
];

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
