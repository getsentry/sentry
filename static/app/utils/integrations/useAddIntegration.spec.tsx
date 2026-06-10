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
      organization: OrganizationFixture(),
      onComplete: expect.any(Function),
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
});
