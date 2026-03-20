import type {ReactNode} from 'react';
import {flushSync} from 'react-dom';

import {ThemeProvider, useTheme} from '@emotion/react';
import {createRoot} from 'react-dom/client';

const renderToString = (tree: ReactNode) => {
  const div = document.createElement('div');
  const root = createRoot(div);

  flushSync(() => {
    root.render(tree);
  });

  const html = div.innerHTML;

  root.unmount();

  return html;
};

export const useRenderToString = () => {
  const theme = useTheme();

  return (tree: ReactNode) =>
    renderToString(<ThemeProvider theme={theme}>{tree}</ThemeProvider>);
};
