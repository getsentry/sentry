// Run pnpm gen:yak-layout after a breakpoint scale changes.
// This module runs at build time. No CSS strings are constructed in a render.
const properties = [
  'separatorBorder',
  'containerType',
  'display',
  'position',
  'inset',
  'top',
  'bottom',
  'left',
  'right',
  'overflow',
  'overflowX',
  'overflowY',
  'overscrollBehavior',
  'pointerEvents',
  'cursor',
  'contain',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'background',
  'backgroundColor',
  'borderRadius',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  'gridArea',
  'gridRow',
  'gridColumn',
  'order',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'justifySelf',
  'border',
  'borderTop',
  'borderBottom',
  'borderLeft',
  'borderRight',
  'visibility',
  'whiteSpace',
  'gap',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignContent',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridTemplateAreas',
  'gridAutoColumns',
  'gridAutoRows',
  'gridAutoFlow',
  'justifyItems',
  'boxShadow',
  'fontSize',
  'lineHeight',
  'textAlign',
  'fontStyle',
  'textDecoration',
  'color',
  'textOverflow',
  'textWrap',
  'wordBreak',
  'fontFamily',
  'fontWeight',
  'fontVariantNumeric',
  'textTransform',
  'textBoxEdge',
  'textBoxTrim',
];
const container = {
  zero: '0px',
  '3xs': '320px',
  '2xs': '384px',
  xs: '448px',
  sm: '512px',
  md: '576px',
  lg: '640px',
  xl: '768px',
  '2xl': '896px',
  '3xl': '1024px',
  '4xl': '1152px',
  '5xl': '1280px',
};
const viewport = {
  '2xs': '0px',
  xs: '500px',
  sm: '800px',
  md: '992px',
  lg: '1200px',
  xl: '1440px',
  '2xl': '2560px',
};
const declaration = (property: string, suffix = '') => {
  const name = 'yk-' + property + suffix;
  const cssProperty =
    property === 'separatorBorder'
      ? '--yk-separator-border'
      : property.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
  return ':where(&).' + name + ' { ' + cssProperty + ': var(--' + name + '); }';
};
export const layoutCss = [
  ...properties.map(property => declaration(property)),
  ...Object.entries(container).flatMap(([key, width]) =>
    properties.map(
      property =>
        '@container (min-width: ' +
        width +
        ') { ' +
        declaration(property, '-' + key) +
        ' }'
    )
  ),
  ...Object.entries(viewport).flatMap(([key, width]) =>
    properties.map(
      property =>
        '@media (min-width: ' +
        width +
        ') { ' +
        declaration(property, '-screen-' + key) +
        ' }'
    )
  ),
].join('\n');
