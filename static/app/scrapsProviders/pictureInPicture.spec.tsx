import {ThemeProvider} from '@emotion/react';

import {act, render, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  PictureInPicturePortal,
  usePictureInPicture,
} from '@sentry/scraps/pictureInPicture';
import {darkTheme, lightTheme} from '@sentry/scraps/theme';

import {SentryPictureInPictureProvider} from './pictureInPicture';

afterEach(() => {
  delete (window as {documentPictureInPicture?: unknown}).documentPictureInPicture;
  document.body.className = '';
});

it('sets app body classes before publishing the window', async () => {
  const pip = {
    document: document.implementation.createHTMLDocument('pip'),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    close: jest.fn(),
  } as unknown as Window;
  Object.defineProperty(window, 'documentPictureInPicture', {
    configurable: true,
    value: {requestWindow: jest.fn().mockResolvedValue(pip)},
  });
  Object.defineProperty(pip.document, 'defaultView', {value: window});
  document.body.className = 'theme-light app-body';
  const {result} = renderHook(() => usePictureInPicture(), {
    wrapper: SentryPictureInPictureProvider,
  });
  await act(async () => {
    await result.current.requestPipWindow();
  });
  expect(result.current.pipWindow).toBe(pip);
  expect(pip.document.body).toHaveClass('theme-light', 'app-body');
});

it('injects app global styles and synchronizes body classes when the theme changes', async () => {
  const pip = {document: document.implementation.createHTMLDocument('pip')} as Window;
  Object.defineProperty(pip.document, 'defaultView', {value: window});
  function Example({theme}: {theme: typeof lightTheme}) {
    return (
      <ThemeProvider theme={theme}>
        <SentryPictureInPictureProvider>
          <PictureInPicturePortal pipWindow={pip}>
            <button type="button">Portal content</button>
          </PictureInPicturePortal>
        </SentryPictureInPictureProvider>
      </ThemeProvider>
    );
  }
  document.body.className = 'theme-light';
  const {rerender, unmount} = render(<Example theme={lightTheme} />);
  expect(pip.document.body).toHaveClass('theme-light');
  expect(
    pip.document.head.querySelector('style[data-emotion="scraps-pip-global"]')
  ).toBeInTheDocument();
  document.body.className = 'theme-dark';
  rerender(<Example theme={darkTheme} />);
  await waitFor(() => expect(pip.document.body).toHaveClass('theme-dark'));
  unmount();
  document.body.className = 'theme-light';
  await act(async () => {});
  expect(pip.document.body).toHaveClass('theme-dark');
  expect(
    pip.document.head.querySelector('style[data-emotion="scraps-pip-global"]')
  ).not.toBeInTheDocument();
});
