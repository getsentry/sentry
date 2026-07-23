import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import * as integrationUtil from 'sentry/utils/integrationUtil';
import {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import {
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequencySection} from './scmAlertFrequencySection';

type Props = React.ComponentProps<typeof ScmAlertFrequencySection>;

const organization = OrganizationFixture();

const notificationProps: IssueAlertNotificationProps = {
  actions: [MultipleCheckboxOptions.EMAIL],
  provider: undefined,
  integration: undefined,
  channel: undefined,
  providersToIntegrations: {},
  queryError: false,
  querySuccess: true,
  shouldRenderSetupButton: false,
  setActions: jest.fn(),
  setProvider: jest.fn(),
  setIntegration: jest.fn(),
  setChannel: jest.fn(),
};

function renderSection(overrides: Partial<Props> = {}) {
  const props: Props = {
    analyticsFlow: 'project-creation',
    alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
    notificationProps,
    onAlertChange: jest.fn(),
    ...overrides,
  };

  render(<ScmAlertFrequencySection {...props} />, {organization});
  return props;
}

describe('ScmAlertFrequencySection', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });
  it('makes the alert-frequency section a collapsible toggle in project creation', async () => {
    renderSection({analyticsFlow: 'project-creation'});

    const toggle = screen.getByRole('button', {name: 'Alert frequency'});
    // Starts collapsed in project creation: the body is hidden until opened.
    expect(
      screen.queryByRole('radiogroup', {name: 'Alert frequency'})
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByRole('radiogroup', {name: 'Alert frequency'})).toBeInTheDocument();
  });

  it('keeps the alert-frequency section always expanded in onboarding', () => {
    renderSection({analyticsFlow: 'onboarding'});

    expect(
      screen.queryByRole('button', {name: 'Alert frequency'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Alert frequency')).toBeInTheDocument();
    expect(screen.getByText('Get notified when things go wrong')).toBeInTheDocument();
  });

  it('shows the notification options when alerts are enabled', () => {
    renderSection({analyticsFlow: 'onboarding'});

    expect(screen.getByText('Notify via')).toBeInTheDocument();
    expect(
      screen.getByText('Integration (Slack, Discord, MS Teams, etc.)')
    ).toBeInTheDocument();
  });

  it('adds the integration action when the Integration checkbox is clicked', async () => {
    const setActions = jest.fn();
    renderSection({
      analyticsFlow: 'onboarding',
      notificationProps: {...notificationProps, setActions},
    });

    // Querying the checkbox by the label text also asserts the label wraps the
    // input, so clicking the text toggles it.
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'Integration (Slack, Discord, MS Teams, etc.)',
      })
    );

    expect(setActions).toHaveBeenCalledWith([
      MultipleCheckboxOptions.EMAIL,
      MultipleCheckboxOptions.INTEGRATION,
    ]);
  });

  it.each([
    ['onboarding', MessagingIntegrationAnalyticsView.ONBOARDING],
    ['project-creation', MessagingIntegrationAnalyticsView.PROJECT_CREATION],
  ] as const)(
    'attributes SCM messaging installs to the %s flow',
    async (analyticsFlow, expectedView) => {
      for (const providerKey of ['slack', 'discord', 'msteams']) {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/config/integrations/`,
          body: {providers: [GitHubIntegrationProviderFixture({key: providerKey})]},
          match: [MockApiClient.matchQuery({provider_key: providerKey})],
        });
      }
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        body: [],
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/pipeline/integration_pipeline/`,
        method: 'POST',
        body: {},
      });
      const trackIntegrationSpy = jest.spyOn(
        integrationUtil,
        'trackIntegrationAnalytics'
      );

      renderGlobalModal();
      renderSection({
        analyticsFlow,
        notificationProps: {...notificationProps, shouldRenderSetupButton: true},
      });
      if (analyticsFlow === 'project-creation') {
        await userEvent.click(screen.getByRole('button', {name: 'Alert frequency'}));
      }
      await userEvent.click(
        await screen.findByRole('button', {name: /connect to messaging/i})
      );
      const addButtons = await screen.findAllByRole('button', {name: /add integration/i});
      await userEvent.click(addButtons[0]!);

      expect(trackIntegrationSpy).toHaveBeenCalledWith(
        'integrations.installation_start',
        expect.objectContaining({view: expectedView, variant: 'scm'})
      );
    }
  );

  it('hides the notification options when alerts are turned off', () => {
    renderSection({
      analyticsFlow: 'onboarding',
      alertRuleConfig: {
        ...DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
        alertSetting: RuleAction.CREATE_ALERT_LATER,
      },
    });

    expect(screen.queryByText('Notify via')).not.toBeInTheDocument();
  });
});
