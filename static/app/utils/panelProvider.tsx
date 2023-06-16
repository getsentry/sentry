import {useMemo} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';

/**
 * Smaller border radii for descendants of panel-like elements. For most
 * elements, the default border radius is 6px. However, for descendants of
 * panel-like elements (e.g. menu items inside overlays), the border radius
 * should be 4px. `smallerBorderRadii` overrides the default 6px and enforces
 * the 4px version on these panel descendants.
 */
const smallerBorderRadii = {
  borderRadius: '4px',
  borderRadiusBottom: '0 0 4px 4px',
  borderRadiusTop: '4px 4px 0 0',
  borderRadiusLeft: '4px 0 0 4px',
  borderRadiusRight: '0 4px 4px 0',
};

/**
 * Nested theme provider that automatically adjusts the styles of descendants
 * of panel-like elements. See `panel.tsx` for usage example.
 */
function PanelProvider({children}: {children: React.ReactNode}) {
  const theme = useTheme();
  const modifiedTheme = useMemo(() => ({...theme, ...smallerBorderRadii}), [theme]);

  return <ThemeProvider theme={modifiedTheme}>{children}</ThemeProvider>;
}

export default PanelProvider;
