import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import * as pipelineModal from 'sentry/components/pipeline/modal';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';

describe('useAddIntegration', () => {
  const provider = GitHubIntegrationProviderFixture();
  const legacyProvider = GitHubIntegrationProviderFixture({
    key: 'custom_legacy',
    slug: 'custom_legacy',
  });
  const integration = GitHubIntegrationFixture();
  let configState: Config;

  beforeEach(() => {
    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
      links: {
        organizationUrl: document.location.origin,
        regionUrl: 'https://us.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
    jest.restoreAllMocks();
  });

  /**
   * Dispatches a MessageEvent that appears to come from the mock popup window,
   * matching the origin and source checks in the hook's message handler.
   */
  function postMessageFromPopup(popup: Window, data: unknown) {
    const event = new MessageEvent('message', {
      data,
      origin: document.location.origin,
    });
    Object.defineProperty(event, 'source', {value: popup});
    window.dispatchEvent(event);
  }

  describe('legacy flow', () => {
    let popup: Window;

    beforeEach(() => {
      popup = {focus: jest.fn(), close: jest.fn()} as unknown as Window;
      jest.spyOn(window, 'open').mockReturnValue(popup);
    });

    it('opens a popup window when startFlow is called', () => {
      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall: jest.fn(),
        })
      );

      expect(window.open).toHaveBeenCalledTimes(1);
      expect(jest.mocked(window.open).mock.calls[0]![0]).toBe(
        '/github-integration-setup-uri/?'
      );
      expect(popup.focus).toHaveBeenCalledTimes(1);
    });

    it('includes account and modalParams in the popup URL', () => {
      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall: jest.fn(),
          account: 'my-account',
          modalParams: {use_staging: '1'},
        })
      );

      const calls = jest.mocked(window.open).mock.calls[0]!;
      const url = calls[0] as string;
      expect(url).toContain('account=my-account');
      expect(url).toContain('use_staging=1');
      expect(calls[1]).toBe('sentryAddStagingIntegration');
    });

    it('includes urlParams passed to startFlow', () => {
      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall: jest.fn(),
          urlParams: {custom_param: 'value'},
        })
      );

      const url = jest.mocked(window.open).mock.calls[0]![0] as string;
      expect(url).toContain('custom_param=value');
    });

    it('calls onInstall when a success message is received', async () => {
      const onInstall = jest.fn();

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall,
        })
      );

      const newIntegration = {
        success: true,
        data: {
          ...integration,
          id: '2',
          domain_name: 'new-integration.github.com',
          icon: 'http://example.com/new-integration-icon.png',
          name: 'New Integration',
        },
      };

      postMessageFromPopup(popup, newIntegration);
      await waitFor(() => expect(onInstall).toHaveBeenCalledWith(newIntegration.data));
    });

    it('shows a success indicator on successful installation', async () => {
      const successSpy = jest.spyOn(indicators, 'addSuccessMessage');

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall: jest.fn(),
        })
      );

      postMessageFromPopup(popup, {success: true, data: integration});
      await waitFor(() => expect(successSpy).toHaveBeenCalledWith('GitHub added'));
    });

    it('shows an error indicator when the message has success: false', async () => {
      const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall: jest.fn(),
        })
      );

      postMessageFromPopup(popup, {success: false, data: {error: 'OAuth failed'}});
      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('OAuth failed'));
    });

    it('shows a generic error when no error message is provided', async () => {
      const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall: jest.fn(),
        })
      );

      postMessageFromPopup(popup, {success: false, data: {}});
      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('An unknown error occurred')
      );
    });

    it('ignores messages from invalid origins', async () => {
      const onInstall = jest.fn();

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall,
        })
      );

      const event = new MessageEvent('message', {
        data: {success: true, data: integration},
        origin: 'https://invalid.example.com',
      });
      Object.defineProperty(event, 'source', {value: popup});

      window.dispatchEvent(event);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(onInstall).not.toHaveBeenCalled();
    });

    it('does not call onInstall when data is empty on success', async () => {
      const onInstall = jest.fn();

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall,
        })
      );

      postMessageFromPopup(popup, {success: true, data: null});

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      expect(onInstall).not.toHaveBeenCalled();
    });

    it('closes the dialog on unmount', () => {
      const {result, unmount} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization: OrganizationFixture(),
          onInstall: jest.fn(),
        })
      );
      unmount();

      expect(popup.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('API pipeline flow', () => {
    it('opens the pipeline modal for unconditionally API-driven providers', () => {
      const openPipelineModalSpy = jest.spyOn(pipelineModal, 'openPipelineModal');
      const onInstall = jest.fn();

      const organization = OrganizationFixture({features: []});

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider,
          organization,
          onInstall,
        })
      );

      expect(openPipelineModalSpy).toHaveBeenCalledWith({
        type: 'integration',
        provider: 'github',
        initialData: undefined,
        onComplete: expect.any(Function),
      });
    });

    it('passes urlParams as initialData to the pipeline modal', () => {
      const openPipelineModalSpy = jest.spyOn(pipelineModal, 'openPipelineModal');

      const organization = OrganizationFixture({features: []});

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider,
          organization,
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

    it('does not open a popup window when the pipeline modal is used', () => {
      jest.spyOn(pipelineModal, 'openPipelineModal');
      jest.spyOn(window, 'open');

      const organization = OrganizationFixture({features: []});

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider,
          organization,
          onInstall: jest.fn(),
        })
      );

      expect(window.open).not.toHaveBeenCalled();
    });

    it('opens the pipeline modal for other unconditional providers without a flag', () => {
      const openPipelineModalSpy = jest.spyOn(pipelineModal, 'openPipelineModal');
      const organization = OrganizationFixture({features: []});
      const gitlabProvider = GitHubIntegrationProviderFixture({
        key: 'gitlab',
        slug: 'gitlab',
        name: 'GitLab',
      });

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: gitlabProvider,
          organization,
          onInstall: jest.fn(),
        })
      );

      expect(openPipelineModalSpy).toHaveBeenCalledWith(
        expect.objectContaining({provider: 'gitlab'})
      );
    });

    it('falls back to legacy flow when the provider is not API driven', () => {
      const openPipelineModalSpy = jest.spyOn(pipelineModal, 'openPipelineModal');
      jest
        .spyOn(window, 'open')
        .mockReturnValue({focus: jest.fn(), close: jest.fn()} as unknown as Window);

      const organization = OrganizationFixture({features: []});

      const {result} = renderHookWithProviders(() => useAddIntegration());

      act(() =>
        result.current.startFlow({
          provider: legacyProvider,
          organization,
          onInstall: jest.fn(),
        })
      );

      expect(openPipelineModalSpy).not.toHaveBeenCalled();
      expect(window.open).toHaveBeenCalledTimes(1);
    });
  });
});
