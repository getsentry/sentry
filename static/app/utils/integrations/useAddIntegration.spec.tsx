import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import * as pipelineModal from 'sentry/components/pipeline/modal';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';

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

  it('reports pipeline failures without also reporting cancellation', () => {
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
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({
      status: 'error',
      providerKey: 'github',
      error: 'Installation failed',
    });
  });
});
