import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePictureInPicture} from 'sentry/utils/usePictureInPicture';

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

  it('reports unsupported when the API is unavailable', () => {
    const {result} = renderHook(() => usePictureInPicture());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.pipWindow).toBeNull();
  });

  it('opens a window and copies stylesheets into it', async () => {
    const style = document.createElement('style');
    style.textContent = '.pip-test{color:red;}';
    document.head.appendChild(style);

    const pip = createFakePipWindow();
    const requestWindow = stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture());
    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      await result.current.openPipWindow({width: 400, height: 600});
    });

    expect(requestWindow).toHaveBeenCalledWith({width: 400, height: 600});
    await waitFor(() => expect(result.current.pipWindow).toBe(pip));
    const copiedStyles = Array.from(pip.document.head.querySelectorAll('style'));
    expect(copiedStyles.some(tag => tag.innerHTML.includes('.pip-test'))).toBe(true);

    document.head.removeChild(style);
  });

  it('resets state and calls onClose when the window is closed by the user', async () => {
    const onClose = jest.fn();
    const pip = createFakePipWindow();
    stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture({onClose}));

    await act(async () => {
      await result.current.openPipWindow();
    });
    await waitFor(() => expect(result.current.pipWindow).toBe(pip));

    // Simulate the user closing the window (fires `pagehide`).
    act(() => {
      pip.__listeners.pagehide!.forEach(fn => fn());
    });

    expect(result.current.pipWindow).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closePipWindow closes the window and is idempotent', async () => {
    const pip = createFakePipWindow();
    stubDocumentPictureInPicture(pip);

    const {result} = renderHook(() => usePictureInPicture());

    await act(async () => {
      await result.current.openPipWindow();
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
