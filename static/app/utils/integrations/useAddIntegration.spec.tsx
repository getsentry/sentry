import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import * as pipelineModal from 'sentry/components/pipeline/modal';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import * as integrationUtil from 'sentry/utils/integrationUtil';

describe('useAddIntegration', () => {
  const provider = GitHubIntegrationProviderFixture();
  const integration = GitHubIntegrationFixture();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the pipeline modal for the provider', () => {
    const openPipelineModalSpy = jest
      .spyOn(pipelineModal, 'openPipelineModal')
      .mockImplementation(() => {});

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
      })
    );

    expect(openPipelineModalSpy).toHaveBeenCalledWith({
      type: 'integration',
      provider: 'github',
      initialData: undefined,
      onComplete: expect.any(Function),
      onError: expect.any(Function),
      onClose: expect.any(Function),
    });
    expect(result.current.state).toEqual({
      status: 'installing',
      providerKey: 'github',
    });
  });

  it('passes urlParams as initialData to the pipeline modal', () => {
    const openPipelineModalSpy = jest
      .spyOn(pipelineModal, 'openPipelineModal')
      .mockImplementation(() => {});

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
        urlParams: {installation_id: '12345'},
      })
    );

    expect(openPipelineModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialData: {installation_id: '12345'},
      })
    );
  });

  it('never opens a popup window', () => {
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(() => {});
    const openSpy = jest.spyOn(window, 'open');

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
      })
    );

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('calls onInstall and shows a success message on completion', () => {
    const successSpy = jest.spyOn(indicators, 'addSuccessMessage');
    const onInstall = jest.fn();

    let onComplete: ((data: typeof integration) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onComplete = options.onComplete as typeof onComplete;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall,
      })
    );

    act(() => onComplete?.(integration));

    expect(onInstall).toHaveBeenCalledWith(integration);
    expect(successSpy).toHaveBeenCalledWith('GitHub added');
    expect(result.current.state).toEqual({
      status: 'complete',
      providerKey: 'github',
      integration,
    });
  });

  it('suppresses the success message when requested', () => {
    const successSpy = jest.spyOn(indicators, 'addSuccessMessage');
    const onInstall = jest.fn();

    let onComplete: ((data: typeof integration) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onComplete = options.onComplete as typeof onComplete;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall,
        suppressSuccessMessage: true,
      })
    );

    act(() => onComplete?.(integration));

    expect(onInstall).toHaveBeenCalledWith(integration);
    expect(successSpy).not.toHaveBeenCalled();
  });

  it('reports cancellation when the pipeline modal closes before completion', () => {
    const onCancel = jest.fn();
    let onClose: (() => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onClose = options.onClose;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
        onCancel,
      })
    );
    act(() => {
      onClose?.();
      onClose?.();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({
      status: 'cancelled',
      providerKey: 'github',
    });
  });

  it('does not report cancellation when completion closes the modal', () => {
    const onCancel = jest.fn();
    let onClose: (() => void) | undefined;
    let onComplete: ((data: typeof integration) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onClose = options.onClose;
      onComplete = options.onComplete as typeof onComplete;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
        onCancel,
      })
    );
    act(() => {
      onComplete?.(integration);
      onClose?.();
    });

    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('complete');
  });

  it('reports a pipeline failure without also reporting cancellation', () => {
    const onCancel = jest.fn();
    const onError = jest.fn();
    let handleError: ((error: string) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      handleError = options.onError;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
        onCancel,
        onError,
      })
    );
    act(() => handleError?.('Installation failed'));

    expect(onError).toHaveBeenCalledWith('Installation failed');
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({
      status: 'error',
      providerKey: 'github',
      error: 'Installation failed',
    });
  });

  it('reports cancellation when the modal closes after a failure', () => {
    const onCancel = jest.fn();
    const onError = jest.fn();
    let onClose: (() => void) | undefined;
    let handleError: ((error: string) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onClose = options.onClose;
      handleError = options.onError;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
        onCancel,
        onError,
      })
    );
    act(() => {
      handleError?.('Installation failed');
      onClose?.();
    });

    expect(onError).toHaveBeenCalledWith('Installation failed');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({
      status: 'cancelled',
      providerKey: 'github',
      lastError: 'Installation failed',
    });
  });

  it('tracks installation_failed once and not installation_cancelled when closing after a failure', () => {
    const onCancel = jest.fn();
    const trackSpy = jest.spyOn(integrationUtil, 'trackIntegrationAnalytics');
    let onClose: (() => void) | undefined;
    let handleError: ((error: string) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onClose = options.onClose;
      handleError = options.onError;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
        onCancel,
      })
    );
    act(() => {
      handleError?.('Installation failed');
      onClose?.();
    });

    expect(trackSpy).toHaveBeenCalledWith(
      'integrations.installation_failed',
      expect.any(Object)
    );
    expect(trackSpy).not.toHaveBeenCalledWith(
      'integrations.installation_cancelled',
      expect.any(Object)
    );
    // UI restore still fires
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('tracks installation_failed once even when the pipeline fails twice, and calls onError both times', () => {
    const onError = jest.fn();
    const trackSpy = jest.spyOn(integrationUtil, 'trackIntegrationAnalytics');
    let handleError: ((error: string) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      handleError = options.onError;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
        onError,
      })
    );
    act(() => {
      handleError?.('Installation failed');
      handleError?.('Installation failed');
    });

    const failedCalls = trackSpy.mock.calls.filter(
      ([event]) => event === 'integrations.installation_failed'
    );
    expect(failedCalls).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('tracks installation_cancelled when closing with no failure', () => {
    const trackSpy = jest.spyOn(integrationUtil, 'trackIntegrationAnalytics');
    let onClose: (() => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onClose = options.onClose;
    });

    const {result: _result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      _result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
      })
    );
    act(() => onClose?.());

    expect(trackSpy).toHaveBeenCalledWith(
      'integrations.installation_cancelled',
      expect.any(Object)
    );
    expect(trackSpy).not.toHaveBeenCalledWith(
      'integrations.installation_failed',
      expect.any(Object)
    );
  });

  it('sets lastError to the most recent failure message when closing after multiple errors', () => {
    let onClose: (() => void) | undefined;
    let handleError: ((error: string) => void) | undefined;
    jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(options => {
      onClose = options.onClose;
      handleError = options.onError;
    });

    const {result} = renderHookWithProviders(() => useAddIntegration());

    act(() =>
      result.current.startFlow({
        provider,
        organization: OrganizationFixture(),
        onInstall: jest.fn(),
      })
    );
    act(() => {
      handleError?.('First error');
      handleError?.('Second error');
      onClose?.();
    });

    expect(result.current.state).toEqual({
      status: 'cancelled',
      providerKey: 'github',
      lastError: 'Second error',
    });
  });
});
