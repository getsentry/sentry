type Globals = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset';
type CssFunction = `${string}(${string})`;
type BaseSize =
  | 'auto'
  | 'fit-content'
  | 'max-content'
  | 'min-content'
  | 'stretch'
  | '0'
  | 0
  | CssFunction;

/**
 * Units that make sense for either dimension.
 */
type BaseUnit = 'px' | 'em' | 'rem' | 'ex' | 'rex' | 'cap' | 'rcap' | 'ch' | 'rch' | '%';

type WidthUnit =
  | BaseUnit
  | 'vw'
  | 'svw'
  | 'lvw'
  | 'dvw'
  | 'vmin'
  | 'vmax'
  | 'svmin'
  | 'svmax'
  | 'lvmin'
  | 'lvmax'
  | 'dvmin'
  | 'dvmax'
  | 'cqw'
  | 'cqi'
  | 'cqmin'
  | 'cqmax';

type HeightUnit =
  | BaseUnit
  | 'vh'
  | 'svh'
  | 'lvh'
  | 'dvh'
  | 'vmin'
  | 'vmax'
  | 'svmin'
  | 'svmax'
  | 'lvmin'
  | 'lvmax'
  | 'dvmin'
  | 'dvmax'
  | 'lh'
  | 'rlh'
  | 'cqh'
  | 'cqb'
  | 'cqmin'
  | 'cqmax';

export type CssWidth = BaseSize | `${number}${WidthUnit}` | Globals;
export type CssMinWidth = CssWidth;
export type CssMaxWidth = CssWidth | 'none';
export type CssHeight = BaseSize | `${number}${HeightUnit}` | Globals;
export type CssMinHeight = CssHeight;
export type CssMaxHeight = CssHeight | 'none';
