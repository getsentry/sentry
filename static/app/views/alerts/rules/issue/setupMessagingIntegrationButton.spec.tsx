import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import HookStore from 'sentry/stores/hookStore';
import SetupMessagingIntegrationButton, {
  MessagingIntegrationAnalyticsView,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

jest.mock('sentry/actionCreators/modal');

describe('SetupAlertIntegrationButton', function () {
  const organization = OrganizationFixture({
    features: ['messaging-integration-onboarding'],
  });
  const project = ProjectFixture();
  const providers = (providerKey: string) => [
    GitHubIntegrationProviderFixture({key: providerKey}),
  ];
  const providerKey = 'slack';

  const getComponent = () => (
    <SetupMessagingIntegrationButton
      projectSlug={project.slug}
      refetchConfigs={jest.fn()}
      analyticsParams={{view: MessagingIntegrationAnalyticsView.ALERT_RULE_CREATION}}
    />
  );

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/?provider_key=${providerKey}`,
      body: {providers: providers(providerKey)},
    });
    jest.clearAllMocks();
  });

  it('renders when no integration is installed', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });
    render(getComponent(), {organization: organization});
    await screen.findByRole('button', {name: /connect to messaging/i});
  });

  it('does not render button if alert integration installed', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: true,
      },
    });
    render(getComponent(), {organization: organization});
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens modal when clicked', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });
    render(getComponent(), {organization: organization});
    const button = await screen.findByRole('button', {name: /connect to messaging/i});
    await userEvent.click(button);
    expect(openModal).toHaveBeenCalled();
  });

  it('does not render button if project is loading', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      statusCode: 400,
      body: {error: 'internal error'},
    });
    render(getComponent(), {organization: organization});
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables button if user does not have integration feature', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {
        ...project,
        hasAlertIntegrationInstalled: false,
      },
    });

    HookStore.add('integrations:feature-gates', () => {
      return {
        IntegrationFeatures: p =>
          p.children({
            disabled: true,
            disabledReason: 'some reason',
            ungatedFeatures: p.features,
            gatedFeatureGroups: [],
          }),
        FeatureList: p => (p.provider = providers[0]),
      };
    });

    render(getComponent(), {organization: organization});
    await screen.findByRole('button', {name: /connect to messaging/i});
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
