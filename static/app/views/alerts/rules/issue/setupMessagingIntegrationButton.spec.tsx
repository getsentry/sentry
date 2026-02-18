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

describe('SetupAlertIntegrationButton', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const providers = (providerKey: string) => [
    GitHubIntegrationProviderFixture({key: providerKey}),
  ];
  const providerKeys = ['slack', 'discord', 'msteams'];
  let mockResponses: Array<jest.Mock<any>> = [];

  const getComponent = () => (
    <SetupMessagingIntegrationButton
      projectId={project.id}
      refetchConfigs={jest.fn()}
      analyticsView={MessagingIntegrationAnalyticsView.ALERT_RULE_CREATION}
    />
  );

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockResponses = [];
    providerKeys.forEach(providerKey => {
      mockResponses.push(
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/config/integrations/`,
          body: {providers: providers(providerKey)},
          match: [MockApiClient.matchQuery({provider_key: providerKey})],
        })
      );
    });
  });

  it('renders when no integration is installed', async () => {
    mockResponses.push(
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        body: [{status: 'disabled'}, {status: 'disabled'}, {status: 'disabled'}],
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      })
    );
    render(getComponent(), {organization});
    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
    await screen.findByRole('button', {name: /connect to messaging/i});
  });

  it('does not render button if alert integration installed', () => {
    mockResponses.push(
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        body: [{status: 'active'}, {status: 'disabled'}, {status: 'disabled'}],
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      })
    );
    render(getComponent(), {organization});
    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens modal when clicked', async () => {
    mockResponses.push(
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        body: [{status: 'disabled'}, {status: 'disabled'}, {status: 'disabled'}],
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      })
    );
    render(getComponent(), {organization});
    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
    const button = await screen.findByRole('button', {name: /connect to messaging/i});
    await userEvent.click(button);
    expect(openModal).toHaveBeenCalled();
  });

  it('does not render button if API errors', () => {
    mockResponses.push(
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        statusCode: 400,
        body: {error: 'internal error'},
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      })
    );
    render(getComponent(), {organization});
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables button if user does not have integration feature', async () => {
    mockResponses.push(
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        body: [{status: 'disabled'}, {status: 'disabled'}, {status: 'disabled'}],
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      })
    );

    HookStore.add('integrations:feature-gates', () => {
      return {
        IntegrationFeatures: p =>
          p.children({
            disabled: true,
            disabledReason: 'some reason',
            ungatedFeatures: p.features,
            gatedFeatureGroups: [],
          }),
        FeatureList: p => (p.provider = (providers as any)[0]),
      };
    });

    render(getComponent(), {organization});
    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
    await screen.findByRole('button', {name: /connect to messaging/i});
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
