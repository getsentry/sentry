/**
 * Font size constraint for typography.
 */
export type FontSize = SizeRange<'xs', '2xl'>;

/**
 * Responsive breakpoint size constraint.
 */
export type BreakpointSize = SizeRange<'2xs', '2xl'>;

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

// -----------------------------------------------------------------------------
// Theme Variants
// -----------------------------------------------------------------------------

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
export type ContentVariant = Exclude<SemanticVariant, 'neutral'> | 'primary' | 'muted';

/**
 * Graphics/icon color variant.
 */
export type GraphicsVariant = Exclude<SemanticVariant, 'neutral'> | 'muted';

/**
 * Border color variant.
 */
export type BorderVariant = Exclude<SemanticVariant, 'neutral'> | 'primary' | 'muted';

// -----------------------------------------------------------------------------
// Component Variants (should be moved locally, aligned to SemanticVariant)
// -----------------------------------------------------------------------------

/**
 * Icon size constraint.
 */
export type IconSize = SizeRange<'xs', '2xl'>;

/**
 * Form element size constraint.
 *
 * Unless you are implementing a new component in the `sentry/components/core`
 * directory, use `ComponentProps['size']` instead.
 * @internal
 */
export type FormSize = SizeRange<'xs', 'md'>;

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
export type AlertVariant = 'subtle' | 'info' | 'warning' | 'success' | 'danger';

/**
 * Error/event severity level.
 */
export type LevelVariant =
  | 'sample'
  | 'info'
  | 'warning'
  | 'error'
  | 'fatal'
  | 'default'
  | 'unknown';

/**
 * Button style variant.
 *
 * Note: 'disabled' is a state, not a variant, but is included for backwards compatibility.
 */
export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'danger'
  | 'link'
  | 'disabled'
  | 'transparent';

// -----------------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------------

type SizeKeys = readonly ['0', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
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
