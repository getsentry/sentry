import {act} from 'react';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {UNCONFIGURED_SCM_MESSAGING_SETUP} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import * as pipelineModal from 'sentry/components/pipeline/modal';
import type {OrganizationIntegration} from 'sentry/types/integrations';

import {ScmMessagingProviderRow} from './scmMessagingProviderRow';
import type {ScmMessagingProviderViewModel} from './useScmMessagingProviders';

const organization = OrganizationFixture();

const slackProvider = GitHubIntegrationProviderFixture({key: 'slack', name: 'Slack'});
const msteamsProvider = GitHubIntegrationProviderFixture({
  key: 'msteams',
  name: 'Microsoft Teams',
});

const slackIntegration = OrganizationIntegrationsFixture({
  id: 'slack-1',
  name: 'test-workspace',
  provider: {
    key: 'slack',
    slug: 'slack',
    name: 'Slack',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
});

const msteamsIntegration = OrganizationIntegrationsFixture({
  id: 'msteams-1',
  name: 'Contoso Teams',
  provider: {
    key: 'msteams',
    slug: 'msteams',
    name: 'Microsoft Teams',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
  configData: {installationType: 'tenant'},
});

const installableSlack: ScmMessagingProviderViewModel = {
  providerKey: 'slack',
  provider: slackProvider,
  status: 'installable',
  integration: undefined,
};

const connectedSlack: ScmMessagingProviderViewModel = {
  providerKey: 'slack',
  provider: slackProvider,
  status: 'connected',
  integration: slackIntegration,
};

const permissionLimitedMsteams: ScmMessagingProviderViewModel = {
  providerKey: 'msteams',
  provider: msteamsProvider,
  status: 'permission-limited',
  integration: msteamsIntegration,
};

const selectedSlackSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'slack',
  integrationId: 'slack-1',
  channelId: 'C123',
  channelName: '#alerts',
  actionTarget: '#alerts',
};

type PipelineCallbacks = {
  onClose?: () => void;
  onComplete?: (data: OrganizationIntegration) => void;
  onError?: (error: string) => void;
};

function mockPipeline(): {callbacks: PipelineCallbacks} {
  const callbacks: PipelineCallbacks = {};
  jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation((opts: any) => {
    callbacks.onComplete = opts.onComplete;
    callbacks.onError = opts.onError;
    callbacks.onClose = opts.onClose;
  });
  return {callbacks};
}

function renderRow(
  viewModel: ScmMessagingProviderViewModel,
  messagingSetup: ScmMessagingSetup = UNCONFIGURED_SCM_MESSAGING_SETUP,
  overrides: {
    onInstallComplete?: jest.Mock;
    onMessagingSetupChange?: jest.Mock;
    renderChannelPicker?: jest.Mock;
  } = {}
) {
  const onInstallComplete = overrides.onInstallComplete ?? jest.fn();
  const onMessagingSetupChange = overrides.onMessagingSetupChange ?? jest.fn();
  const renderChannelPicker = overrides.renderChannelPicker;

  return render(
    <ScmMessagingProviderRow
      viewModel={viewModel}
      messagingSetup={messagingSetup}
      onInstallComplete={onInstallComplete}
      onMessagingSetupChange={onMessagingSetupChange}
      renderChannelPicker={renderChannelPicker}
    />,
    {organization}
  );
}

describe('ScmMessagingProviderRow', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('installable state', () => {
    it('renders provider name, description, and Connect button', () => {
      renderRow(installableSlack);

      expect(screen.getByText('Slack')).toBeInTheDocument();
      expect(
        screen.getByText(/Get real-time alerts and triage issues without leaving Slack/)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Connect Slack/})).toBeInTheDocument();
    });

    it('opens the install flow when Connect is clicked', async () => {
      const {callbacks} = mockPipeline();

      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));

      expect(pipelineModal.openPipelineModal).toHaveBeenCalledTimes(1);
      expect(callbacks.onComplete).toBeDefined();
    });

    it('fires install start analytics with onboarding view and scm variant', async () => {
      mockPipeline();
      const trackSpy = jest.spyOn(
        await import('sentry/utils/integrationUtil'),
        'trackIntegrationAnalytics'
      );

      renderRow(installableSlack);
      await userEvent.click(screen.getByRole('button', {name: /Connect/}));

      expect(trackSpy).toHaveBeenCalledWith(
        'integrations.installation_start',
        expect.objectContaining({
          integration: 'slack',
          view: 'onboarding',
          variant: 'scm',
        })
      );
    });
  });

  describe('installing state', () => {
    it('shows a spinner while the install modal is open', async () => {
      mockPipeline();
      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));

      expect(screen.queryByRole('button', {name: /Connect/})).not.toBeInTheDocument();
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('install-error state', () => {
    it('shows the error message and a Try again button after install fails', async () => {
      const {callbacks} = mockPipeline();
      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onError?.('Something went wrong with the OAuth flow.'));

      expect(
        screen.getByText('Something went wrong with the OAuth flow.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Try again/})).toBeInTheDocument();
    });

    it('shows the error state when the modal is closed after a failure', async () => {
      const {callbacks} = mockPipeline();
      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => {
        callbacks.onError?.('OAuth failed');
        callbacks.onClose?.();
      });

      expect(screen.getByText('OAuth failed')).toBeInTheDocument();
    });

    it('reopens the install flow when Try again is clicked', async () => {
      const {callbacks} = mockPipeline();
      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onError?.('Error'));

      await userEvent.click(screen.getByRole('button', {name: /Try again/}));

      expect(pipelineModal.openPipelineModal).toHaveBeenCalledTimes(2);
    });

    it('surfaces a repeated identical error after Try again', async () => {
      const {callbacks} = mockPipeline();
      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onError?.('Connection refused'));

      await userEvent.click(screen.getByRole('button', {name: /Try again/}));
      act(() => callbacks.onError?.('Connection refused'));

      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });

    it('shows a fallback error when no message is available', async () => {
      const {callbacks} = mockPipeline();
      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onError?.(''));

      expect(
        screen.getByText('Installation failed. Please try again.')
      ).toBeInTheDocument();
    });
  });

  describe('cancelled without error', () => {
    it('returns to the installable state when the modal is closed cleanly', async () => {
      const {callbacks} = mockPipeline();
      renderRow(installableSlack);

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onClose?.());

      expect(screen.getByRole('button', {name: /Connect/})).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows a spinner after install completes while the view model is still stale', async () => {
      const {callbacks} = mockPipeline();
      const onInstallComplete = jest.fn();
      renderRow(installableSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        onInstallComplete,
      });

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onComplete?.(slackIntegration));

      expect(onInstallComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('permission-limited state', () => {
    it('shows workspace name, an explanation, and a disabled Connect button', () => {
      renderRow(permissionLimitedMsteams);

      expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      expect(screen.getByText('Contoso Teams')).toBeInTheDocument();
      expect(screen.getByText(/tenant-level connection/)).toBeInTheDocument();

      const addBtn = screen.getByRole('button', {name: /Connect/});
      expect(addBtn).toBeDisabled();
    });
  });

  describe('configuring state (connected, not yet configured)', () => {
    it('immediately renders the channel picker without any interaction', () => {
      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);
      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {renderChannelPicker});

      expect(screen.getByText('channel-picker')).toBeInTheDocument();
      expect(renderChannelPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          integration: slackIntegration,
          onCancel: undefined,
          onConfigured: expect.any(Function),
        })
      );
    });

    it('saves the setup and transitions to configured when onConfigured is called', () => {
      const onMessagingSetupChange = jest.fn();
      let capturedOnConfigured:
        | ((setup: ScmMessagingSetup & {mode: 'selected'}) => void)
        | undefined;

      const renderChannelPicker = jest.fn(
        ({onConfigured}: {onConfigured: (s: any) => void}) => {
          capturedOnConfigured = onConfigured;
          return <div>channel-picker</div>;
        }
      );

      const {rerender} = renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        onMessagingSetupChange,
        renderChannelPicker,
      });

      act(() => capturedOnConfigured?.(selectedSlackSetup));
      expect(onMessagingSetupChange).toHaveBeenCalledWith(selectedSlackSetup);

      // Simulate the parent updating the prop after receiving the save callback.
      rerender(
        <ScmMessagingProviderRow
          viewModel={connectedSlack}
          messagingSetup={selectedSlackSetup}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={onMessagingSetupChange}
          renderChannelPicker={renderChannelPicker}
        />
      );

      expect(screen.queryByText('channel-picker')).not.toBeInTheDocument();
    });
  });

  describe('configured state', () => {
    it('shows workspace / channel and Edit + Remove buttons', () => {
      renderRow(connectedSlack, selectedSlackSetup);

      expect(screen.getByText('Slack')).toBeInTheDocument();
      expect(screen.getByText('test-workspace')).toBeInTheDocument();
      expect(screen.getByText('#alerts')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Edit/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Remove/})).toBeInTheDocument();
    });

    it('enters configuring state when Edit is clicked and passes onCancel to the picker', async () => {
      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);
      renderRow(connectedSlack, selectedSlackSetup, {renderChannelPicker});

      await userEvent.click(screen.getByRole('button', {name: /Edit/}));

      expect(screen.getByText('channel-picker')).toBeInTheDocument();
      expect(renderChannelPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          onCancel: expect.any(Function),
        })
      );
    });
  });

  describe('removing state', () => {
    it('shows a confirmation when Remove is clicked', async () => {
      renderRow(connectedSlack, selectedSlackSetup);

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));

      expect(screen.getByText(/Remove Slack integration\?/)).toBeInTheDocument();
      expect(screen.getByText(/You can reconnect at any time/)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Cancel/})).toBeInTheDocument();
    });

    it('returns to configured when Cancel is clicked', async () => {
      renderRow(connectedSlack, selectedSlackSetup);

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));
      await userEvent.click(screen.getByRole('button', {name: /Cancel/}));

      expect(screen.getByRole('button', {name: /Edit/})).toBeInTheDocument();
      expect(screen.queryByText(/You can reconnect at any time/)).not.toBeInTheDocument();
    });

    it('calls onMessagingSetupChange with unconfigured when confirmed', async () => {
      const onMessagingSetupChange = jest.fn();
      renderRow(connectedSlack, selectedSlackSetup, {onMessagingSetupChange});

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));

      const [confirmBtn] = screen.getAllByRole('button', {name: /Remove/});
      await userEvent.click(confirmBtn);

      expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
    });
  });
});
