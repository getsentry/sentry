import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  dispatchPipelineMessage,
  setupMockPopup,
} from 'sentry/components/pipeline/testUtils';

import {useRedirectPopupStep} from './useRedirectPopupStep';

function Harness({
  onCallback,
  redirectUrl = 'https://github.com/login/oauth/authorize',
}: {
  onCallback: (data: Record<string, string>) => void;
  redirectUrl?: string;
}) {
  const {openPopup, popupStatus} = useRedirectPopupStep({
    redirectUrl,
    onCallback,
  });

  return (
    <div>
      <button type="button" onClick={openPopup}>
        Open
      </button>
      <span data-test-id="status">{popupStatus}</span>
    </div>
  );
}

describe('useRedirectPopupStep', () => {
  let mockPopup: Window;

  beforeEach(() => {
    mockPopup = setupMockPopup();
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        ...globalThis.crypto,
        randomUUID: () => 'test-nonce-123',
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the popup with a nonce-suffixed window name', async () => {
    render(<Harness onCallback={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Open'}));

    expect(window.open).toHaveBeenCalledWith(
      'https://github.com/login/oauth/authorize',
      'pipeline_popup_test-nonce-123',
      expect.any(String)
    );
    expect(screen.getByTestId('status')).toHaveTextContent('popup-open');
  });

  it('accepts postMessage validated by nonce even when event.source differs', async () => {
    const onCallback = jest.fn();
    render(<Harness onCallback={onCallback} />);

    await userEvent.click(screen.getByRole('button', {name: 'Open'}));

    // Simulate Safari WindowProxy identity churn after cross-origin navigation:
    // trampoline posts from a source that is no longer === popupRef.current.
    dispatchPipelineMessage({
      source: null,
      data: {
        _pipeline_source: 'sentry-pipeline',
        _pipeline_nonce: 'test-nonce-123',
        code: 'auth-code',
        state: 'auth-state',
      },
    });

    expect(onCallback).toHaveBeenCalledWith({
      code: 'auth-code',
      state: 'auth-state',
    });
    expect(mockPopup.close).toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('not-open');
  });

  it('still accepts postMessage validated by event.source without a nonce', async () => {
    const onCallback = jest.fn();
    render(<Harness onCallback={onCallback} />);

    await userEvent.click(screen.getByRole('button', {name: 'Open'}));

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        code: 'auth-code',
        state: 'auth-state',
      },
    });

    expect(onCallback).toHaveBeenCalledWith({
      code: 'auth-code',
      state: 'auth-state',
    });
  });

  it('rejects messages with a mismatched nonce when source does not match', async () => {
    const onCallback = jest.fn();
    render(<Harness onCallback={onCallback} />);

    await userEvent.click(screen.getByRole('button', {name: 'Open'}));

    dispatchPipelineMessage({
      source: null,
      data: {
        _pipeline_source: 'sentry-pipeline',
        _pipeline_nonce: 'wrong-nonce',
        code: 'auth-code',
        state: 'auth-state',
      },
    });

    expect(onCallback).not.toHaveBeenCalled();
  });

  it('strips nonce metadata before invoking onCallback', async () => {
    const onCallback = jest.fn();
    render(<Harness onCallback={onCallback} />);

    await userEvent.click(screen.getByRole('button', {name: 'Open'}));

    dispatchPipelineMessage({
      source: mockPopup,
      data: {
        _pipeline_source: 'sentry-pipeline',
        _pipeline_nonce: 'test-nonce-123',
        installation_id: 'inst-1',
      },
    });

    expect(onCallback).toHaveBeenCalledWith({installation_id: 'inst-1'});
  });
});
