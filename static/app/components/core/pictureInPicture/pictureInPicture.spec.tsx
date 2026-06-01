import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  PictureInPictureProvider,
  usePictureInPicture,
} from '@sentry/scraps/pictureInPicture';

type FakePipWindow = Window & {
  __listeners: Record<string, Array<() => void>>;
};

function createFakePipWindow(): FakePipWindow {
  const doc = document.implementation.createHTMLDocument('pip');
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

describe('usePictureInPicture', () => {
  afterEach(() => {
    // @ts-expect-error - cleaning up the stub
    delete window.documentPictureInPicture;
  });

  it('throws when used outside of a provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => usePictureInPicture())).toThrow(
      'usePictureInPicture must be used within a PictureInPictureProvider'
    );
    // eslint-disable-next-line no-console
    jest.mocked(console.error).mockRestore();
  });

  it('reports unsupported when the API is unavailable', () => {
    const {result} = renderHook(() => usePictureInPicture(), {
      wrapper: PictureInPictureProvider,
    });
    expect(result.current.isSupported).toBe(false);
    expect(result.current.pipWindow).toBeNull();
  });

  it('opens a window and copies stylesheets into it', async () => {
    const style = document.createElement('style');
    style.textContent = '.pip-test{color:red;}';
    document.head.appendChild(style);

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

    document.head.removeChild(style);
  });

  it('does not copy emotion style tags (they are re-injected by the portal)', async () => {
    const emotionStyle = document.createElement('style');
    emotionStyle.setAttribute('data-emotion', 'app');
    emotionStyle.textContent = '.emotion-skip{color:blue;}';
    document.head.appendChild(emotionStyle);

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
