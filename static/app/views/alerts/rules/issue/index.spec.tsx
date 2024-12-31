import moment from 'moment-timezone';
import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectAlertRuleFixture} from 'sentry-fixture/projectAlertRule';
import {ProjectAlertRuleConfigurationFixture} from 'sentry-fixture/projectAlertRuleConfiguration';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import {metric} from 'sentry/utils/analytics';
import IssueRuleEditor from 'sentry/views/alerts/rules/issue';
import {permissionAlertText} from 'sentry/views/settings/project/permissionAlert';
import ProjectAlerts from 'sentry/views/settings/projectAlerts';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/onboardingTasks');
jest.mock('sentry/actionCreators/indicator', () => ({
  addSuccessMessage: jest.fn(),
  addErrorMessage: jest.fn(),
  addLoadingMessage: jest.fn(),
}));
jest.mock('sentry/utils/analytics', () => ({
  metric: {
    startSpan: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    endSpan: jest.fn(),
    mark: jest.fn(),
    measure: jest.fn(),
  },
  trackAnalytics: jest.fn(),
}));

const projectAlertRuleDetailsRoutes: PlainRoute<any>[] = [
  {
    path: '/',
  },
  {
    path: '/settings/',
    indexRoute: {},
  },
  {
    path: ':orgId/',
  },
  {
    path: 'projects/:projectId/',
  },
  {},
  {
    indexRoute: {},
  },
  {
    path: 'alerts/',
    indexRoute: {},
  },
  {
    path: 'rules/',
    indexRoute: {},
    childRoutes: [{path: 'new/'}, {path: ':ruleId/'}],
  },
  {path: ':ruleId/'},
];

const createWrapper = (props = {}) => {
  const {organization, project, router} = initializeOrg(props);
  const params = {
    projectId: project.slug,
    organizationId: organization.slug,
    ruleId: router.location.query.createFromDuplicate ? undefined : '1',
  };
  const onChangeTitleMock = jest.fn();
  const wrapper = render(
    <ProjectAlerts
      {...RouteComponentPropsFixture()}
      organization={organization}
      project={project}
      params={params}
    >
      <IssueRuleEditor
        route={RouteComponentPropsFixture().route}
        routeParams={RouteComponentPropsFixture().routeParams}
        params={params}
        location={router.location}
        routes={projectAlertRuleDetailsRoutes}
        router={router}
        members={[]}
        onChangeTitle={onChangeTitleMock}
        project={project}
        userTeamIds={[]}
      />
    </ProjectAlerts>,
    {router, organization}
  );

  return {
    wrapper,
    organization,
    project,
    onChangeTitleMock,
    router,
  };
};

describe('IssueRuleEditor', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/configuration/',
      body: ProjectAlertRuleConfigurationFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      body: ProjectAlertRuleFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: EnvironmentsFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/?expand=hasAlertIntegration`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/preview/',
      method: 'POST',
      body: [],
    });
    ProjectsStore.loadInitialData([ProjectFixture()]);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/?integrationType=messaging`,
      body: [],
    });
    const providerKeys = ['slack', 'discord', 'msteams'];
    providerKeys.forEach(providerKey => {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/config/integrations/?provider_key=${providerKey}`,
        body: {providers: [GitHubIntegrationProviderFixture({key: providerKey})]},
      });
    });
  });

  afterEach(function () {
    jest.clearAllMocks();
    ProjectsStore.reset();
  });

  describe('Viewing the rule', () => {
    it('is visible without org-level alerts:write', async () => {
      createWrapper({
        organization: {access: []},
        projects: [{access: []}],
      });

      expect(await screen.findByText(permissionAlertText)).toBeInTheDocument();
      expect(screen.queryByLabelText('Save Rule')).toBeDisabled();
    });

    it('is enabled with org-level alerts:write', async () => {
      createWrapper({
        organization: {access: ['alerts:write']},
        projects: [{access: []}],
      });

      expect(await screen.findByLabelText('Save Rule')).toBeEnabled();
      expect(screen.queryByText(permissionAlertText)).not.toBeInTheDocument();
    });

    it('is enabled with project-level alerts:write', async () => {
      createWrapper({
        organization: {access: []},
        projects: [{access: ['alerts:write']}],
      });

      expect(await screen.findByLabelText('Save Rule')).toBeEnabled();
      expect(screen.queryByText(permissionAlertText)).not.toBeInTheDocument();
    });
  });

  describe('Edit Rule', function () {
    let mock;
    const endpoint = '/projects/org-slug/project-slug/rules/1/';
    beforeEach(function () {
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'PUT',
        body: ProjectAlertRuleFixture(),
      });
    });

    it('gets correct rule name', async function () {
      const rule = ProjectAlertRuleFixture();
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'GET',
        body: rule,
      });
      const {onChangeTitleMock} = createWrapper();
      await waitFor(() => expect(mock).toHaveBeenCalled());
      expect(onChangeTitleMock).toHaveBeenCalledWith(rule.name);
    });

    it('deletes rule', async function () {
      const deleteMock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'DELETE',
        body: {},
      });
      const {router} = createWrapper();
      renderGlobalModal({router});
      await userEvent.click(screen.getByLabelText('Delete Rule'));

      expect(
        await screen.findByText(/Are you sure you want to delete "My alert rule"\?/)
      ).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => expect(deleteMock).toHaveBeenCalled());
      expect(router.replace).toHaveBeenCalledWith(
        '/settings/org-slug/projects/project-slug/alerts/'
      );
    });

    it('saves rule with condition value of 0', async function () {
      const rule = ProjectAlertRuleFixture({
        conditions: [
          {id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition'},
          {
            id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
            value: 0,
          },
        ],
      });
      MockApiClient.addMockResponse({
        url: endpoint,
        method: 'GET',
        body: rule,
      });
      createWrapper();
      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() =>
        expect(mock).toHaveBeenCalledWith(
          endpoint,
          expect.objectContaining({
            data: expect.objectContaining({
              conditions: [
                {id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition'},
                {
                  id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
                  value: '0', // Verify that the 0 is converted to a string by the serializer
                },
              ],
            }),
          })
        )
      );
      expect(addErrorMessage).toHaveBeenCalledTimes(0);
    });

    it('sends correct environment value', async function () {
      createWrapper();
      await selectEvent.select(screen.getByText('staging'), 'production');
      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() =>
        expect(mock).toHaveBeenCalledWith(
          endpoint,
          expect.objectContaining({
            data: expect.objectContaining({environment: 'production'}),
          })
        )
      );
      expect(metric.startSpan).toHaveBeenCalledTimes(1);
      expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('strips environment value if "All environments" is selected', async function () {
      createWrapper();
      await selectEvent.select(screen.getByText('staging'), 'All Environments');
      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
      expect(mock).not.toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: expect.objectContaining({environment: '__all_environments__'}),
        })
      );
      expect(metric.startSpan).toHaveBeenCalledTimes(1);
      expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('updates the alert onboarding task', async function () {
      createWrapper();
      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => expect(updateOnboardingTask).toHaveBeenCalledTimes(1));
      expect(metric.startSpan).toHaveBeenCalledTimes(1);
      expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('renders multiple sentry apps at the same time', async () => {
      const linearApp = {
        id: 'sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction',
        enabled: true,
        actionType: 'sentryapp',
        service: 'linear',
        sentryAppInstallationUuid: 'linear-d864bc2a8755',
        prompt: 'Linear',
        label: 'Create a Linear issue with these ',
        formFields: {
          type: 'alert-rule-settings',
          uri: '/hooks/sentry/alert-rule-action',
          description:
            'When the alert fires automatically create a Linear issue with the following properties.',
          required_fields: [
            {
              name: 'teamId',
              label: 'Team',
              type: 'select',
              uri: '/hooks/sentry/issues/teams',
              choices: [['test-6f0b2b4d402b', 'Sentry']],
            },
          ],
          optional_fields: [
            // Optional fields removed
          ],
        },
      };
      const threadsApp = {
        id: 'sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction',
        enabled: true,
        actionType: 'sentryapp',
        service: 'threads',
        sentryAppInstallationUuid: 'threads-987c470e50cc',
        prompt: 'Threads',
        label: 'Post to a Threads channel with these ',
        formFields: {
          type: 'alert-rule-settings',
          uri: '/sentry/saveAlert',
          required_fields: [
            {
              type: 'select',
              label: 'Channel',
              name: 'channel',
              async: true,
              uri: '/sentry/channels',
              choices: [],
            },
          ],
        },
      };

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/configuration/',
        body: {actions: [linearApp, threadsApp], conditions: [], filters: []},
      });

      createWrapper();
      await selectEvent.select(await screen.findByText('Add action...'), 'Threads');
      await selectEvent.select(screen.getByText('Add action...'), 'Linear');

      expect(screen.getByText('Create a Linear issue with these')).toBeInTheDocument();
      expect(
        screen.getByText('Post to a Threads channel with these')
      ).toBeInTheDocument();
    });

    it('opts out of the alert being disabled', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/1/',
        body: ProjectAlertRuleFixture({
          status: 'disabled',
          disableDate: moment().add(1, 'day').toISOString(),
        }),
      });
      createWrapper();
      await userEvent.click(await screen.findByRole('button', {name: 'Save Rule'}));

      await waitFor(() =>
        expect(mock).toHaveBeenCalledWith(
          endpoint,
          expect.objectContaining({
            data: expect.objectContaining({optOutEdit: true}),
          })
        )
      );
    });

    it('renders environment selector in adopted release filter', async function () {
      createWrapper({
        projects: [ProjectFixture({environments: ['production', 'staging']})],
      });

      // Add the adopted release filter
      await selectEvent.select(
        screen.getByText('Add optional filter...'),
        /The {oldest_or_newest} adopted release associated/
      );

      const filtersContainer = await screen.findByTestId('rule-filters');

      // Production environment is preselected because it's the first option.
      // staging should also be selectable.
      await selectEvent.select(
        within(filtersContainer).getAllByText('production')[0],
        'staging'
      );
    });
  });

  describe('Edit Rule: Slack Channel Look Up', function () {
    const uuid = 'xxxx-xxxx-xxxx';

    beforeEach(function () {
      jest.useFakeTimers();
    });

    afterEach(function () {
      jest.clearAllTimers();
    });

    it('success status updates the rule', async function () {
      const mockSuccess = MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/rule-task/${uuid}/`,
        body: {status: 'success', rule: ProjectAlertRuleFixture({name: 'Slack Rule'})},
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/1/',
        method: 'PUT',
        statusCode: 202,
        body: {uuid},
      });
      const {router} = createWrapper();
      await userEvent.click(await screen.findByRole('button', {name: 'Save Rule'}), {
        delay: null,
      });

      act(() => jest.advanceTimersByTime(1000));
      await waitFor(() => expect(addLoadingMessage).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(addSuccessMessage).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockSuccess).toHaveBeenCalledTimes(1));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
      });
    });

    it('pending status keeps loading true', async function () {
      const pollingMock = MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/rule-task/${uuid}/`,
        body: {status: 'pending'},
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/1/',
        method: 'PUT',
        statusCode: 202,
        body: {uuid},
      });
      createWrapper();
      await userEvent.click(await screen.findByRole('button', {name: 'Save Rule'}), {
        delay: null,
      });

      act(() => jest.advanceTimersByTime(1000));
      expect(addLoadingMessage).toHaveBeenCalledTimes(2);
      expect(pollingMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByTestId('loading-mask')).toBeInTheDocument();
    });

    it('failed status renders error message', async function () {
      const mockFailed = MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/rule-task/${uuid}/`,
        body: {status: 'failed'},
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/1/',
        method: 'PUT',
        statusCode: 202,
        body: {uuid},
      });
      createWrapper();
      await userEvent.click(await screen.findByRole('button', {name: 'Save Rule'}), {
        delay: null,
      });

      act(() => jest.advanceTimersByTime(1000));
      await waitFor(() => expect(addLoadingMessage).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(mockFailed).toHaveBeenCalledTimes(1));
      expect(addErrorMessage).toHaveBeenCalledTimes(1);
      expect(addErrorMessage).toHaveBeenCalledWith('An error occurred');
    });
  });

  describe('Duplicate Rule', function () {
    let mock;
    const rule = ProjectAlertRuleFixture();
    const endpoint = `/projects/org-slug/project-slug/rules/${rule.id}/`;

    beforeEach(function () {
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'GET',
        body: rule,
      });
    });

    it('gets correct rule to duplicate and renders fields correctly', async function () {
      createWrapper({
        organization: {
          access: ['alerts:write'],
        },
        router: {
          location: {
            query: {
              createFromDuplicate: 'true',
              duplicateRuleId: `${rule.id}`,
            },
          },
        },
      });

      expect(await screen.findByTestId('alert-name')).toHaveValue(`${rule.name} copy`);
      expect(screen.getByText('A new issue is created')).toBeInTheDocument();
      expect(mock).toHaveBeenCalled();
    });

    it('does not add FirstSeenEventCondition to a duplicate rule', async function () {
      MockApiClient.addMockResponse({
        url: endpoint,
        method: 'GET',
        body: {...rule, conditions: []},
      });
      createWrapper({
        organization: {
          access: ['alerts:write'],
        },
        router: {
          location: {
            query: {
              createFromDuplicate: 'true',
              duplicateRuleId: `${rule.id}`,
            },
          },
        },
      });

      expect(await screen.findByTestId('alert-name')).toHaveValue(`${rule.name} copy`);
      expect(screen.queryByText('A new issue is created')).not.toBeInTheDocument();
    });
  });
});
