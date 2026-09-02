type Globals = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset' | CssFunction;
type CssFunction = `${string}(${string})`;
type BaseDimension = 'auto' | '0' | 0;
type BaseSize = 'fit-content' | 'max-content' | 'min-content' | 'stretch' | BaseDimension;
type CssNumber = number | `${number}`;
type GridPlacement = 'auto' | number | (string & {});
type GridTrackSize = 'auto' | 'max-content' | 'min-content' | number | (string & {});

type BaselinePosition = 'baseline' | `${'first' | 'last'} baseline`;
type OverflowPosition = 'safe' | 'unsafe';
type SelfPosition =
  | 'center'
  | 'start'
  | 'end'
  | 'self-start'
  | 'self-end'
  | 'flex-start'
  | 'flex-end';
type SelfAlignment =
  | 'auto'
  | 'normal'
  | 'stretch'
  | 'anchor-center'
  | 'dialog'
  | BaselinePosition
  | SelfPosition
  | `${OverflowPosition} ${SelfPosition}`;

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

type BaseFlexBasis =
  | 'none'
  | 'content'
  | 'max-content'
  | 'min-content'
  | 'fit-content'
  | BaseDimension;

type CssFlexBasis = BaseFlexBasis | `${number}${WidthUnit}` | CssFunction | Globals;

type Width = BaseSize | `${number}${WidthUnit}` | Globals;
type Height = BaseSize | `${number}${HeightUnit}` | Globals;
type Cursor =
  | Globals
  | '-moz-grab'
  | '-webkit-grab'
  | 'alias'
  | 'all-scroll'
  | 'auto'
  | 'cell'
  | 'col-resize'
  | 'context-menu'
  | 'copy'
  | 'crosshair'
  | 'default'
  | 'e-resize'
  | 'ew-resize'
  | 'grab'
  | 'grabbing'
  | 'help'
  | 'move'
  | 'n-resize'
  | 'ne-resize'
  | 'nesw-resize'
  | 'no-drop'
  | 'none'
  | 'not-allowed'
  | 'ns-resize'
  | 'nw-resize'
  | 'nwse-resize'
  | 'pointer'
  | 'progress'
  | 'row-resize'
  | 's-resize'
  | 'se-resize'
  | 'sw-resize'
  | 'text'
  | 'vertical-text'
  | 'w-resize'
  | 'wait'
  | 'zoom-in'
  | 'zoom-out';

type Contain =
  | Globals
  | 'content'
  | 'layout'
  | 'none'
  | 'paint'
  | 'size'
  | 'strict'
  | 'style';

type PointerEvents =
  | Globals
  | 'all'
  | 'auto'
  | 'fill'
  | 'inherit'
  | 'none'
  | 'painted'
  | 'stroke'
  | 'visible'
  | 'visibleFill'
  | 'visiblePainted'
  | 'visibleStroke';

type AspectRatio = `${number}/${number}` | `${number}` | 'auto' | Globals;

type Position = Globals | 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';

export type CSS = {
  alignSelf: SelfAlignment | Globals;
  aspectRatio: AspectRatio;
  contain: Contain;
  cursor: Cursor;
  display:
    | 'block'
    | 'inline'
    | 'inline-block'
    | 'flex'
    | 'inline-flex'
    | 'grid'
    | 'inline-grid'
    | 'contents'
    | 'none';
  flex:
    | CssFlexBasis
    | 'none'
    | 'auto'
    | 'initial'
    | number
    | `${number}`
    | `${number} ${number}`
    | `${number} ${CssFlexBasis}`
    | `${number} ${number} ${CssFlexBasis}`
    | Globals;
  flexBasis: CssFlexBasis;
  flexGrow: CssNumber | Globals;
  flexShrink: CssNumber | Globals;
  gridArea: GridPlacement | Globals;
  gridAutoColumns: GridTrackSize | Globals;
  gridAutoRows: GridTrackSize | Globals;
  gridColumn: GridPlacement | Globals;
  gridRow: GridPlacement | Globals;
  gridTemplateAreas: 'none' | (string & {}) | Globals;
  gridTemplateColumns: 'none' | 'subgrid' | 'masonry' | number | (string & {}) | Globals;
  gridTemplateRows: 'none' | 'subgrid' | 'masonry' | number | (string & {}) | Globals;
  height: Height;
  inset: `${number}${HeightUnit}` | Globals | BaseDimension;
  justifySelf:
    | SelfAlignment
    | 'left'
    | 'right'
    | `${OverflowPosition} ${SelfPosition | 'left' | 'right'}`
    | Globals;
  maxHeight: Height | 'none';
  maxWidth: Width | 'none';
  minHeight: Height;
  minWidth: Width;
  order: CssNumber | Globals;
  pointerEvents: PointerEvents;
  position: Position;
  width: Width;
};
