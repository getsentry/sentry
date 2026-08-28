import {act, useState} from 'react';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ScmMessagingActiveRow} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import {UNCONFIGURED_SCM_MESSAGING_SETUP} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import * as pipelineModal from 'sentry/components/pipeline/modal';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import {ScmMessagingProviderRow} from './scmMessagingProviderRow';
import type {ScmMessagingResolvedProvider} from './useScmMessagingProviders';

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

const installableSlack: ScmMessagingResolvedProvider = {
  providerKey: 'slack',
  provider: slackProvider,
  status: 'installable',
  eligibleIntegrations: [],
  permissionLimitedIntegration: undefined,
};

const connectedSlack: ScmMessagingResolvedProvider = {
  providerKey: 'slack',
  provider: slackProvider,
  status: 'connected',
  eligibleIntegrations: [slackIntegration],
  permissionLimitedIntegration: undefined,
};

const permissionLimitedMsteams: ScmMessagingResolvedProvider = {
  providerKey: 'msteams',
  provider: msteamsProvider,
  status: 'permission-limited',
  eligibleIntegrations: [],
  permissionLimitedIntegration: msteamsIntegration,
};

const selectedSlackSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'slack',
  integrationId: 'slack-1',
  channelId: 'C123',
  channelName: '#alerts',
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

function ControlledRow({
  resolvedProvider,
  messagingSetup,
  initialActiveRow = null,
  isRefetchingIntegrations = false,
  onInstallComplete = jest.fn(),
  onMessagingSetupChange = jest.fn(),
  renderChannelPicker,
}: {
  messagingSetup: ScmMessagingSetup;
  resolvedProvider: ScmMessagingResolvedProvider;
  initialActiveRow?: ScmMessagingActiveRow;
  isRefetchingIntegrations?: boolean;
  onInstallComplete?: jest.Mock;
  onMessagingSetupChange?: jest.Mock;
  renderChannelPicker?: jest.Mock;
}) {
  const [activeRow, setActiveRow] = useState<ScmMessagingActiveRow>(initialActiveRow);
  return (
    <ScmMessagingProviderRow
      resolvedProvider={resolvedProvider}
      messagingSetup={messagingSetup}
      activeRow={activeRow}
      onActiveRowChange={setActiveRow}
      onInstallComplete={onInstallComplete}
      onMessagingSetupChange={onMessagingSetupChange}
      renderChannelPicker={renderChannelPicker}
      isRefetchingIntegrations={isRefetchingIntegrations}
    />
  );
}

function renderRow(
  resolvedProvider: ScmMessagingResolvedProvider,
  messagingSetup: ScmMessagingSetup = UNCONFIGURED_SCM_MESSAGING_SETUP,
  overrides: {
    initialActiveRow?: ScmMessagingActiveRow;
    isRefetchingIntegrations?: boolean;
    onInstallComplete?: jest.Mock;
    onMessagingSetupChange?: jest.Mock;
    organization?: Partial<Organization>;
    renderChannelPicker?: jest.Mock;
  } = {}
) {
  const onInstallComplete = overrides.onInstallComplete ?? jest.fn();
  const onMessagingSetupChange = overrides.onMessagingSetupChange ?? jest.fn();
  const renderChannelPicker = overrides.renderChannelPicker;
  const org = overrides.organization ?? organization;

  return render(
    <ControlledRow
      resolvedProvider={resolvedProvider}
      messagingSetup={messagingSetup}
      initialActiveRow={overrides.initialActiveRow}
      onInstallComplete={onInstallComplete}
      onMessagingSetupChange={onMessagingSetupChange}
      renderChannelPicker={renderChannelPicker}
      isRefetchingIntegrations={overrides.isRefetchingIntegrations ?? false}
    />,
    {organization: org}
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

  describe('install-forbidden state', () => {
    const noAccessOrg = OrganizationFixture({access: []});

    it('renders the description and a disabled Connect button', () => {
      renderRow(installableSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        organization: noAccessOrg,
      });

      expect(
        screen.getByText(/Get real-time alerts and triage issues without leaving Slack/)
      ).toBeInTheDocument();
      expect(
        screen.getByText('Ask an organization admin to connect Slack.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Connect Slack/})).toBeDisabled();
    });

    it('does not open the install pipeline when Connect is clicked', async () => {
      mockPipeline();
      renderRow(installableSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        organization: noAccessOrg,
      });

      // The button is disabled so the click is a no-op, but confirm openPipelineModal
      // was never called regardless of how the disabled state is enforced.
      await userEvent.click(screen.getByRole('button', {name: /Connect Slack/}));
      expect(pipelineModal.openPipelineModal).not.toHaveBeenCalled();
    });

    it('still shows the Choose destination CTA for a connected provider', () => {
      // A member without org:integrations cannot install, but can still configure
      // a destination on an integration that is already connected.
      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        organization: noAccessOrg,
      });

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: /Choose destination/})
      ).toBeInTheDocument();
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
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/channels/',
        body: {results: []},
      });
      const {callbacks} = mockPipeline();

      const {rerender} = render(
        <ScmMessagingProviderRow
          resolvedProvider={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
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
          resolvedProvider={connectedSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
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
    it('shows a spinner after install completes while integrations are refetching', async () => {
      const {callbacks} = mockPipeline();
      const onInstallComplete = jest.fn();

      // Render directly (not via ControlledRow) so rerender preserves hook state.
      const {rerender} = render(
        <ScmMessagingProviderRow
          resolvedProvider={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={onInstallComplete}
          onMessagingSetupChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onComplete?.(slackIntegration));

      expect(onInstallComplete).toHaveBeenCalledTimes(1);

      // Parent signals that refetch is now active.
      rerender(
        <ScmMessagingProviderRow
          resolvedProvider={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={onInstallComplete}
          onMessagingSetupChange={jest.fn()}
          isRefetchingIntegrations
        />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('stops spinning when the installed integration resolves to permission-limited', async () => {
      const {callbacks} = mockPipeline();
      const installableMsteams: ScmMessagingResolvedProvider = {
        providerKey: 'msteams',
        provider: msteamsProvider,
        status: 'installable',
        eligibleIntegrations: [],
        permissionLimitedIntegration: undefined,
      };

      const {rerender} = render(
        <ScmMessagingProviderRow
          resolvedProvider={installableMsteams}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />,
        {organization}
      );

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onComplete?.(msteamsIntegration));

      // Simulate parent refetch starting.
      rerender(
        <ScmMessagingProviderRow
          resolvedProvider={installableMsteams}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
          isRefetchingIntegrations
        />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

      // The refetched resolved provider settles to a tenant (permission-limited) result.
      rerender(
        <ScmMessagingProviderRow
          resolvedProvider={permissionLimitedMsteams}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />
      );

      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(screen.getByText(/tenant-level connection/)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Connect/})).toBeDisabled();
    });

    it('shows Connect once the refetch settles even when no integration surfaced', async () => {
      // Regression: previously the awaitingInstall latch was only cleared when
      // the integration appeared, so a refetch that returned nothing left the
      // row spinning forever with no way to retry.
      const {callbacks} = mockPipeline();

      const {rerender} = render(
        <ScmMessagingProviderRow
          resolvedProvider={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />,
        {organization}
      );

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));
      act(() => callbacks.onComplete?.(slackIntegration));

      // Simulate parent refetch starting (spinner should show).
      rerender(
        <ScmMessagingProviderRow
          resolvedProvider={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
          isRefetchingIntegrations
        />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

      // Refetch settles but still no integration — must fall back to Connect.
      rerender(
        <ScmMessagingProviderRow
          resolvedProvider={installableSlack}
          messagingSetup={UNCONFIGURED_SCM_MESSAGING_SETUP}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={jest.fn()}
        />
      );

      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Connect/})).toBeInTheDocument();
    });

    it('shows the picker when the parent sets activeRow to configuring', () => {
      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);

      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {
        initialActiveRow: {providerKey: 'slack', mode: 'configuring'},
        renderChannelPicker,
      });

      expect(screen.getByText('channel-picker')).toBeInTheDocument();
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

  describe('choose-destination state (connected, not yet configured)', () => {
    it('shows the Connected tag and Choose destination CTA without opening the picker', () => {
      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);
      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {renderChannelPicker});

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.queryByText('Destination added')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: /Choose destination/})
      ).toBeInTheDocument();
      expect(screen.queryByText('channel-picker')).not.toBeInTheDocument();
    });

    it('opens the channel picker with onCancel when Choose destination is clicked', async () => {
      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);
      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {renderChannelPicker});

      expect(screen.queryByText('channel-picker')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /Choose destination/}));

      expect(screen.getByText('channel-picker')).toBeInTheDocument();
      expect(renderChannelPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          integrations: [slackIntegration],
          onCancel: expect.any(Function),
          onConfigured: expect.any(Function),
        })
      );
    });

    it('returns to choose-destination when Cancel is clicked on first-time configure', async () => {
      let capturedOnCancel: (() => void) | undefined;
      const renderChannelPicker = jest.fn(({onCancel}: {onCancel: () => void}) => {
        capturedOnCancel = onCancel;
        return <div>channel-picker</div>;
      });

      renderRow(connectedSlack, UNCONFIGURED_SCM_MESSAGING_SETUP, {renderChannelPicker});

      await userEvent.click(screen.getByRole('button', {name: /Choose destination/}));
      expect(screen.getByText('channel-picker')).toBeInTheDocument();

      act(() => capturedOnCancel?.());

      await waitFor(() =>
        expect(screen.queryByText('channel-picker')).not.toBeInTheDocument()
      );
      expect(
        screen.getByRole('button', {name: /Choose destination/})
      ).toBeInTheDocument();
    });

    it('passes only eligible integrations to the picker when a provider has mixed installations', async () => {
      const msteamsTeamIntegration = OrganizationIntegrationsFixture({
        id: 'msteams-team',
        name: 'Team Workspace',
        provider: {
          key: 'msteams',
          slug: 'msteams',
          name: 'Microsoft Teams',
          canAdd: true,
          canDisable: false,
          features: [],
          aspects: {},
        },
        configData: {installationType: 'team'},
      });

      const mixedMsteams: ScmMessagingResolvedProvider = {
        providerKey: 'msteams',
        provider: msteamsProvider,
        status: 'connected',
        eligibleIntegrations: [msteamsTeamIntegration],
        permissionLimitedIntegration: undefined,
      };

      const renderChannelPicker = jest.fn(() => <div>channel-picker</div>);
      renderRow(mixedMsteams, UNCONFIGURED_SCM_MESSAGING_SETUP, {renderChannelPicker});

      await userEvent.click(screen.getByRole('button', {name: /Choose destination/}));

      expect(renderChannelPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          integrations: [msteamsTeamIntegration],
        })
      );
    });

    it('does not treat a setup referencing an ineligible integration as configured', () => {
      const msteamsTeamIntegration = OrganizationIntegrationsFixture({
        id: 'msteams-team',
        name: 'Team Workspace',
        provider: {
          key: 'msteams',
          slug: 'msteams',
          name: 'Microsoft Teams',
          canAdd: true,
          canDisable: false,
          features: [],
          aspects: {},
        },
        configData: {installationType: 'team'},
      });

      const mixedMsteams: ScmMessagingResolvedProvider = {
        providerKey: 'msteams',
        provider: msteamsProvider,
        status: 'connected',
        eligibleIntegrations: [msteamsTeamIntegration],
        permissionLimitedIntegration: undefined,
      };

      // A destination previously saved against the tenant (ineligible) integration.
      const tenantSetup: ScmMessagingSetup = {
        mode: 'selected',
        providerKey: 'msteams',
        integrationId: 'msteams-tenant',
        channelId: 'C1',
        channelName: '#general',
      };

      renderRow(mixedMsteams, tenantSetup);

      // Should NOT be in configured state — the tenant integration is not eligible.
      expect(screen.queryByRole('button', {name: /Edit/})).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: /Remove/})).not.toBeInTheDocument();
      // Shows choose-destination CTA instead of auto-expanding the picker.
      expect(
        screen.getByRole('button', {name: /Choose destination/})
      ).toBeInTheDocument();
    });

    it('saves the setup and transitions to configured when onConfigured is called', async () => {
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

      await userEvent.click(screen.getByRole('button', {name: /Choose destination/}));

      act(() => capturedOnConfigured?.(selectedSlackSetup));
      expect(onMessagingSetupChange).toHaveBeenCalledWith(selectedSlackSetup);

      // Simulate the parent updating the messagingSetup prop after the save.
      rerender(
        <ScmMessagingProviderRow
          resolvedProvider={connectedSlack}
          messagingSetup={selectedSlackSetup}
          activeRow={null}
          onActiveRowChange={jest.fn()}
          onInstallComplete={jest.fn()}
          onMessagingSetupChange={onMessagingSetupChange}
          renderChannelPicker={renderChannelPicker}
        />
      );

      await waitFor(() =>
        expect(screen.queryByText('channel-picker')).not.toBeInTheDocument()
      );
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

    it('shows the Destination added tag', () => {
      renderRow(connectedSlack, selectedSlackSetup);

      expect(screen.getByText('Destination added')).toBeInTheDocument();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
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

      expect(screen.getByText('Remove this destination?')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This removes the destination from project setup. The integration stays connected to your organization.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Cancel/})).toBeInTheDocument();
    });

    it('returns to configured when Cancel is clicked', async () => {
      renderRow(connectedSlack, selectedSlackSetup);

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));
      await userEvent.click(screen.getByRole('button', {name: /Cancel/}));

      expect(screen.getByRole('button', {name: /Edit/})).toBeInTheDocument();
      expect(
        screen.queryByText(
          'This removes the destination from project setup. The integration stays connected to your organization.'
        )
      ).not.toBeInTheDocument();
    });

    it('calls onMessagingSetupChange with unconfigured when confirmed', async () => {
      const onMessagingSetupChange = jest.fn();
      renderRow(connectedSlack, selectedSlackSetup, {onMessagingSetupChange});

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));
      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));

      expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
    });
  });
});
