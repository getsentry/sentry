import {ThemeProvider, useTheme} from '@emotion/react';

const smallerBorderRadii = {
  borderRadius: '4px',
  borderRadiusBottom: '0 0 4px 4px',
  borderRadiusTop: '4px 4px 0 0',
  borderRadiusLeft: '4px 0 0 4px',
  borderRadiusRight: '0 4px 4px 0',
};

const PanelProvider = ({children}: {children: React.ReactNode}) => {
  const theme = useTheme();

  return (
    <ThemeProvider theme={{...theme, ...smallerBorderRadii}}>{children}</ThemeProvider>
  );
};

export default PanelProvider;
