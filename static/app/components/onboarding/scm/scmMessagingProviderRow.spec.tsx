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

    it('clears the error when the integration surfaces via a shared refetch', async () => {
      const {callbacks} = mockPipeline();

      const {rerender} = render(
        <ScmMessagingProviderRow
          viewModel={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />,
        {organization}
      );

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onError?.('OAuth failed'));

      expect(screen.getByText('OAuth failed')).toBeInTheDocument();

      // The integrations query is shared: another row's successful install
      // refetches it and reveals this provider's integration despite the local
      // error. The row must drop the error instead of offering a Try again that
      // would reinstall an existing integration.
      rerender(
        <ScmMessagingProviderRow
          viewModel={connectedSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />
      );

      expect(screen.queryByText('OAuth failed')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: /Try again/})).not.toBeInTheDocument();
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

    it('stops spinning when the installed integration resolves to permission-limited', async () => {
      const {callbacks} = mockPipeline();
      const installableMsteams: ScmMessagingProviderViewModel = {
        providerKey: 'msteams',
        provider: msteamsProvider,
        status: 'installable',
        integration: undefined,
      };

      const {rerender} = render(
        <ScmMessagingProviderRow
          viewModel={installableMsteams}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />,
        {organization}
      );

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onComplete?.(msteamsIntegration));

      // The refetched view model settles to a tenant (permission-limited) result.
      rerender(
        <ScmMessagingProviderRow
          viewModel={permissionLimitedMsteams}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />
      );

      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(screen.getByText(/tenant-level connection/)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Add destination/})).toBeDisabled();
    });

    it('shows Connect (not a spinner) if the integration disappears after install', async () => {
      const {callbacks} = mockPipeline();

      const {rerender} = render(
        <ScmMessagingProviderRow
          viewModel={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />,
        {organization}
      );

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onComplete?.(slackIntegration));

      // Integration surfaces...
      rerender(
        <ScmMessagingProviderRow
          viewModel={connectedSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />
      );

      // ...then is removed externally, returning the row to installable.
      rerender(
        <ScmMessagingProviderRow
          viewModel={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />
      );

      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Connect/})).toBeInTheDocument();
    });
  });

  describe('permission-limited state', () => {
    it('shows workspace name, an explanation, and a disabled Add destination button', () => {
      renderRow(permissionLimitedMsteams);

      expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      expect(screen.getByText('Contoso Teams')).toBeInTheDocument();
      expect(screen.getByText(/tenant-level connection/)).toBeInTheDocument();

      const addBtn = screen.getByRole('button', {name: /Add destination/});
      expect(addBtn).toBeDisabled();
    });
  });

  describe('connected state', () => {
    it('shows workspace name and Add destination button', () => {
      renderRow(connectedSlack);

      expect(screen.getByText('Slack')).toBeInTheDocument();
      expect(screen.getByText('test-workspace')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Add destination/})).toBeInTheDocument();
    });
  });

  describe('configuring state', () => {
    it('enters configuring state and calls renderChannelPicker when Add destination is clicked', async () => {
      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);
      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        renderChannelPicker,
      });

      await userEvent.click(screen.getByRole('button', {name: /Add destination/}));

      expect(screen.getByText('channel-picker')).toBeInTheDocument();
      expect(renderChannelPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          integration: slackIntegration,
          onCancel: expect.any(Function),
          onConfigured: expect.any(Function),
        })
      );
    });

    it('exits configuring state when onCancel is called', async () => {
      let capturedOnCancel: (() => void) | undefined;
      const renderChannelPicker = jest.fn(({onCancel}: {onCancel: () => void}) => {
        capturedOnCancel = onCancel;
        return <div>channel-picker</div>;
      });

      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        renderChannelPicker,
      });

      await userEvent.click(screen.getByRole('button', {name: /Add destination/}));
      expect(screen.getByText('channel-picker')).toBeInTheDocument();

      act(() => capturedOnCancel?.());

      expect(screen.queryByText('channel-picker')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Add destination/})).toBeInTheDocument();
    });

    it('saves the setup and exits configuring when onConfigured is called', async () => {
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

      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        onMessagingSetupChange,
        renderChannelPicker,
      });

      await userEvent.click(screen.getByRole('button', {name: /Add destination/}));

      act(() => capturedOnConfigured?.(selectedSlackSetup));

      expect(onMessagingSetupChange).toHaveBeenCalledWith(selectedSlackSetup);
      expect(screen.queryByText('channel-picker')).not.toBeInTheDocument();
    });
  });

  describe('configured state', () => {
    it('shows workspace · channel and Edit + Remove buttons', () => {
      renderRow(connectedSlack, selectedSlackSetup);

      expect(screen.getByText('Slack')).toBeInTheDocument();
      expect(screen.getByText('test-workspace')).toBeInTheDocument();
      expect(screen.getByText('#alerts')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Edit/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Remove/})).toBeInTheDocument();
    });

    it('enters configuring state when Edit is clicked', async () => {
      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);
      renderRow(connectedSlack, selectedSlackSetup, {renderChannelPicker});

      await userEvent.click(screen.getByRole('button', {name: /Edit/}));

      expect(screen.getByText('channel-picker')).toBeInTheDocument();
    });
  });

  describe('removing state', () => {
    it('shows a confirmation when Remove is clicked', async () => {
      renderRow(connectedSlack, selectedSlackSetup);

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));

      expect(screen.getByText(/Remove #alerts/)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Cancel/})).toBeInTheDocument();
    });

    it('returns to configured when Cancel is clicked', async () => {
      renderRow(connectedSlack, selectedSlackSetup);

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));
      await userEvent.click(screen.getByRole('button', {name: /Cancel/}));

      expect(screen.getByRole('button', {name: /Edit/})).toBeInTheDocument();
      expect(
        screen.queryByText(/The .* workspace will remain connected/)
      ).not.toBeInTheDocument();
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
