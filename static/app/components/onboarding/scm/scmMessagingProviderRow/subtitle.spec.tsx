import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {UNCONFIGURED_SCM_MESSAGING_SETUP} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {ScmMessagingResolvedProvider} from 'sentry/components/onboarding/scm/useScmMessagingProviders';

import {RowSubtitle} from './subtitle';
import type {RowVisualState} from './types';

const slackProvider = GitHubIntegrationProviderFixture({key: 'slack', name: 'Slack'});
const msteamsProvider = GitHubIntegrationProviderFixture({
  key: 'msteams',
  name: 'Microsoft Teams',
});

const slackIntegration = OrganizationIntegrationsFixture({
  id: 'slack-1',
  name: 'test-workspace',
});
const msteamsIntegration = OrganizationIntegrationsFixture({
  id: 'msteams-1',
  name: 'Contoso Teams',
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

const permissionLimitedSlack: ScmMessagingResolvedProvider = {
  providerKey: 'slack',
  provider: slackProvider,
  status: 'permission-limited',
  eligibleIntegrations: [],
  permissionLimitedIntegration: slackIntegration,
};

const selectedSlackSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'slack',
  integrationId: 'slack-1',
  channelId: 'C123',
  channelName: '#alerts',
};

function renderSubtitle(
  visualState: RowVisualState,
  resolvedProvider: ScmMessagingResolvedProvider = installableSlack,
  messagingSetup: ScmMessagingSetup = UNCONFIGURED_SCM_MESSAGING_SETUP
) {
  return render(
    <RowSubtitle
      visualState={visualState}
      resolvedProvider={resolvedProvider}
      messagingSetup={messagingSetup}
    />
  );
}

describe('RowSubtitle', () => {
  describe.each<RowVisualState>([
    'installable',
    'loading',
    'installing',
    'choose-destination',
  ])('%s state', visualState => {
    it('shows the provider description', () => {
      renderSubtitle(visualState);
      expect(
        screen.getByText(/Get real-time alerts and triage issues without leaving Slack/)
      ).toBeInTheDocument();
    });
  });

  describe('install-forbidden state', () => {
    it('shows the provider description and admin copy', () => {
      renderSubtitle('install-forbidden');

      expect(
        screen.getByText(/Get real-time alerts and triage issues without leaving Slack/)
      ).toBeInTheDocument();
      expect(
        screen.getByText('Ask an organization admin to connect Slack.')
      ).toBeInTheDocument();
    });
  });

  describe('permission-limited state', () => {
    it('shows workspace name and tenant-level copy for msteams', () => {
      renderSubtitle('permission-limited', permissionLimitedMsteams);

      expect(screen.getByText('Contoso Teams')).toBeInTheDocument();
      expect(screen.getByText(/tenant-level connection/)).toBeInTheDocument();
    });

    it('shows workspace name and generic copy for non-msteams providers', () => {
      renderSubtitle('permission-limited', permissionLimitedSlack);

      expect(screen.getByText('test-workspace')).toBeInTheDocument();
      expect(
        screen.getByText(/does not have the required permissions/)
      ).toBeInTheDocument();
    });
  });

  describe('configured state', () => {
    it('shows workspace name and channel name', () => {
      renderSubtitle('configured', connectedSlack, selectedSlackSetup);

      expect(screen.getByText('test-workspace')).toBeInTheDocument();
      expect(screen.getByText('#alerts')).toBeInTheDocument();
    });
  });

  describe('removing state', () => {
    it('shows the removal explanation', () => {
      renderSubtitle('removing', connectedSlack, selectedSlackSetup);

      expect(
        screen.getByText(
          'This removes the destination from project setup. The integration stays connected to your organization.'
        )
      ).toBeInTheDocument();
    });
  });

  describe.each<RowVisualState>(['install-error', 'configuring'])(
    '%s state',
    visualState => {
      it('renders nothing', () => {
        const {container} = renderSubtitle(visualState);
        expect(container).toBeEmptyDOMElement();
      });
    }
  );
});
