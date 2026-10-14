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

export type ButtonVariant =
  | 'secondary'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'link'
  | 'transparent';
