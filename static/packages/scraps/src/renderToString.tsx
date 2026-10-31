import {type ReactNode, useCallback} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {
  __unsafe_useEmotionCache,
  CacheProvider,
  ThemeProvider,
  useTheme,
} from '@emotion/react';

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
  const cache = __unsafe_useEmotionCache();

  return useCallback(
    (tree: ReactNode) =>
      renderToString(
        <CacheProvider value={cache}>
          <ThemeProvider theme={theme}>{tree}</ThemeProvider>
        </CacheProvider>
      ),
    [cache, theme]
  );
};
