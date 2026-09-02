type Globals = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset' | CssFunction;
type CssFunction = `${string}(${string})`;
type BaseDimension = 'auto' | '0' | 0;
type BaseSize = 'fit-content' | 'max-content' | 'min-content' | 'stretch' | BaseDimension;

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

type Width = BaseSize | `${number}${WidthUnit}` | Globals;
type Height = BaseSize | `${number}${HeightUnit}` | Globals;

export type CSS = {
  height: Height;
  inset: `${number}${HeightUnit}` | Globals | BaseDimension;
  maxHeight: Height | 'none';
  maxWidth: Width | 'none';
  minHeight: Height;
  minWidth: Width;
  width: Width;
};
