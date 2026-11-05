/* oxlint-disable testing-library/no-node-access -- Stylesheet-copy tests inspect style nodes, which have no accessible role. */
import type * as React from 'react';
import {useContext} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';
import {act, render, renderHook, waitFor, within} from '@testing-library/react';

import {
  PictureInPicturePortal,
  PictureInPictureProvider,
  usePictureInPicture,
} from '@sentry/scraps/pictureInPicture';
import {darkTheme, lightTheme} from '@sentry/scraps/theme';
import {TooltipContext} from '@sentry/scraps/tooltip';

type FakePipWindow = Window & {
  __listeners: Record<string, Array<() => void>>;
};

function createFakePipWindow(): FakePipWindow {
  const doc = document.implementation.createHTMLDocument('pip');
  // Detached jsdom documents need a browsing context for accessibility queries.
  Object.defineProperty(doc, 'defaultView', {value: window});
  const listeners: Record<string, Array<() => void>> = {};

  const win = {
    document: doc,
    closed: false,
    close: jest.fn(() => {
      win.closed = true;
      (listeners.pagehide ?? []).forEach(fn => fn());
    }),
    focus: jest.fn(),
    addEventListener: jest.fn((type: string, fn: () => void) => {
      (listeners[type] ??= []).push(fn);
    }),
    removeEventListener: jest.fn((type: string, fn: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter(listener => listener !== fn);
    }),
    __listeners: listeners,
  };

  return win as unknown as FakePipWindow;
}

function stubDocumentPictureInPicture(pip: FakePipWindow) {
  const requestWindow = jest.fn().mockResolvedValue(pip);
  Object.defineProperty(window, 'documentPictureInPicture', {
    configurable: true,
    writable: true,
    value: {requestWindow, window: null},
  });
  return requestWindow;
}

// jsdom doesn't populate `CSSStyleSheet.ownerNode` (real browsers do), which
// `copyStyles` relies on to detect emotion styles. Backfill it so tests exercise
// the same code path as production.
function appendStyle(css: string, attributes: Record<string, string> = {}) {
  const style = document.createElement('style');
  for (const [name, value] of Object.entries(attributes)) {
    style.setAttribute(name, value);
  }
  style.textContent = css;
  document.head.appendChild(style);

  if (style.sheet && !style.sheet.ownerNode) {
    Object.defineProperty(style.sheet, 'ownerNode', {value: style, configurable: true});
  }

  return style;
}

describe('usePictureInPicture', () => {
  afterEach(() => {
    delete (window as {documentPictureInPicture?: unknown}).documentPictureInPicture;
  });

  it('throws when used outside of a provider', () => {
    expect(() => renderHook(() => usePictureInPicture())).toThrow(
      'usePictureInPicture must be used within a PictureInPictureProvider'
    );
  });

  it('reports unsupported when the API is unavailable', () => {
    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: PictureInPictureProvider,
    });
    expect(result.current.isSupported).toBe(false);
    expect(result.current.pipWindow).toBeNull();
  });

  it('opens a window and copies stylesheets into it', async () => {
    document.body.className = 'app-owned';
    const style = appendStyle('.pip-test{color:red;}');

    const pip = createFakePipWindow();
    const requestWindow = stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: PictureInPictureProvider,
    });
    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      await result.current.requestPipWindow({width: 400, height: 600});
    });

    expect(requestWindow).toHaveBeenCalledWith(
      expect.objectContaining({width: 400, height: 600})
    );
    await waitFor(() => expect(result.current.pipWindow).toBe(pip));
    const copiedStyles = Array.from(pip.document.head.querySelectorAll('style'));
    expect(copiedStyles.some(tag => tag.innerHTML.includes('.pip-test'))).toBe(true);
    expect(pip.document.body.className).toBe('');
    document.body.className = '';

    document.head.removeChild(style);
  });

  it('does not copy emotion style tags (they are re-injected by the portal)', async () => {
    const emotionStyle = appendStyle('.emotion-skip{color:blue;}', {
      'data-emotion': 'app',
    });

    const pip = createFakePipWindow();
    stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: PictureInPictureProvider,
    });

    await act(async () => {
      await result.current.requestPipWindow();
    });
    await waitFor(() => expect(result.current.pipWindow).toBe(pip));

    const copiedStyles = Array.from(pip.document.head.querySelectorAll('style'));
    expect(copiedStyles.some(tag => tag.innerHTML.includes('.emotion-skip'))).toBe(false);

    document.head.removeChild(emotionStyle);
  });

  it('resolves relative urls against the source stylesheet', async () => {
    const style = appendStyle('.bg{background:url(images/x.png);}');
    // jsdom leaves `sheet.href` null — point it at a known stylesheet location.
    if (style.sheet) {
      Object.defineProperty(style.sheet, 'href', {
        value: 'https://consumer.example.com/assets/app.css',
        configurable: true,
      });
    }

    const pip = createFakePipWindow();
    stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: PictureInPictureProvider,
    });

    await act(async () => {
      await result.current.requestPipWindow();
    });
    await waitFor(() => expect(result.current.pipWindow).toBe(pip));

    const copied = Array.from(pip.document.head.querySelectorAll('style'))
      .map(tag => tag.innerHTML)
      .join('');
    expect(copied).toContain('https://consumer.example.com/assets/images/x.png');

    document.head.removeChild(style);
  });

  it('closes the window and stays untracked if setup fails', async () => {
    const pip = createFakePipWindow();
    stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: ({children}: {children: React.ReactNode}) => (
        <PictureInPictureProvider
          onWindowOpen={() => {
            throw new Error('setup failed');
          }}
        >
          {children}
        </PictureInPictureProvider>
      ),
    });

    await act(async () => {
      await expect(result.current.requestPipWindow()).rejects.toThrow('setup failed');
    });

    expect(pip.close).toHaveBeenCalledTimes(1);
    expect(result.current.pipWindow).toBeNull();
  });

  it('resets state when the window is closed by the user', async () => {
    const pip = createFakePipWindow();
    stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: PictureInPictureProvider,
    });

    await act(async () => {
      await result.current.requestPipWindow();
    });
    await waitFor(() => expect(result.current.pipWindow).toBe(pip));

    // Simulate the user closing the window (fires `pagehide`).
    act(() => {
      pip.__listeners.pagehide!.forEach(fn => fn());
    });

    expect(result.current.pipWindow).toBeNull();
  });

  it('closePipWindow closes the window and is idempotent', async () => {
    const pip = createFakePipWindow();
    stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: PictureInPictureProvider,
    });

    await act(async () => {
      await result.current.requestPipWindow();
    });
    await waitFor(() => expect(result.current.pipWindow).toBe(pip));

    act(() => {
      result.current.closePipWindow();
    });
    expect(pip.close).toHaveBeenCalledTimes(1);
    expect(result.current.pipWindow).toBeNull();

    // Calling again is a no-op.
    act(() => {
      result.current.closePipWindow();
    });
    expect(pip.close).toHaveBeenCalledTimes(1);
  });
});

it('leaves body-class policy to the consumer and initializes a window before publishing it', async () => {
  const pip = createFakePipWindow();
  const requestWindow = stubDocumentPictureInPicture(pip);
  const onWindowOpen = jest.fn(window => {
    window.document.body.className = 'consumer-theme';
  });
  const {result, unmount} = renderHook(() => usePictureInPicture(), {
    wrapper: ({children}: {children: React.ReactNode}) => (
      <PictureInPictureProvider onWindowOpen={onWindowOpen}>
        {children}
      </PictureInPictureProvider>
    ),
  });
  await act(async () => {
    await result.current.requestPipWindow();
  });
  expect(onWindowOpen).toHaveBeenCalledWith(pip);
  expect(pip.document.body).toHaveClass('consumer-theme');
  await act(async () => {
    await result.current.requestPipWindow();
  });
  expect(requestWindow).toHaveBeenCalledTimes(1);
  unmount();
  expect(pip.close).toHaveBeenCalledTimes(1);
  expect(pip.removeEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
  delete (window as {documentPictureInPicture?: unknown}).documentPictureInPicture;
});

it('propagates a rejected window request without publishing a window', async () => {
  const pip = createFakePipWindow();
  const requestWindow = stubDocumentPictureInPicture(pip);
  requestWindow.mockRejectedValueOnce(new Error('Not allowed'));
  const {result} = renderHook(() => usePictureInPicture(), {
    wrapper: PictureInPictureProvider,
  });
  await act(async () => {
    await expect(result.current.requestPipWindow()).rejects.toThrow('Not allowed');
  });
  expect(result.current.pipWindow).toBeNull();
  expect(pip.close).not.toHaveBeenCalled();
  delete (window as {documentPictureInPicture?: unknown}).documentPictureInPicture;
});

function PortalContent({pipWindow}: {pipWindow: Window}) {
  const theme = useTheme();
  const {container} = useContext(TooltipContext);
  return (
    <button type="button">
      {theme.type}{' '}
      {container === pipWindow.document.body ? 'local overlays' : 'wrong overlays'}
    </button>
  );
}

it('keeps portal content, theme, styling cache, and overlays in the target document', () => {
  const pip = createFakePipWindow();
  const {rerender, unmount} = render(
    <ThemeProvider theme={lightTheme}>
      <PictureInPicturePortal pipWindow={pip}>
        <PortalContent pipWindow={pip} />
      </PictureInPicturePortal>
    </ThemeProvider>
  );
  expect(
    within(pip.document.body).getByRole('button', {name: 'light local overlays'})
  ).toBeInTheDocument();
  expect(pip.document.documentElement).toHaveStyle({height: '100%'});
  expect(pip.document.body).toHaveStyle({height: '100%', margin: '0px'});
  expect(pip.document.body.className).toBe('');
  rerender(
    <ThemeProvider theme={darkTheme}>
      <PictureInPicturePortal pipWindow={pip}>
        <PortalContent pipWindow={pip} />
      </PictureInPicturePortal>
    </ThemeProvider>
  );
  expect(
    within(pip.document.body).getByRole('button', {name: 'dark local overlays'})
  ).toBeInTheDocument();
  unmount();
  expect(within(pip.document.body).queryByRole('button')).not.toBeInTheDocument();
});
