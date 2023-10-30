import {browserHistory, PlainRoute} from 'react-router';
import selectEvent from 'react-select-event';
import moment from 'moment';
import {ProjectAlertRule} from 'sentry-fixture/projectAlertRule';
import {ProjectAlertRuleConfiguration} from 'sentry-fixture/projectAlertRuleConfiguration';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import ProjectsStore from 'sentry/stores/projectsStore';
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
    startTransaction: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    endTransaction: jest.fn(),
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
  const {organization, project, routerContext, router} = initializeOrg(props);
  const params = {
    projectId: project.slug,
    organizationId: organization.slug,
    ruleId: router.location.query.createFromDuplicate ? undefined : '1',
  };
  const onChangeTitleMock = jest.fn();
  const wrapper = render(
    <ProjectAlerts
      {...TestStubs.routeComponentProps()}
      organization={organization}
      project={project}
      params={params}
    >
      <IssueRuleEditor
        route={TestStubs.routeComponentProps().route}
        routeParams={TestStubs.routeComponentProps().routeParams}
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
    {context: routerContext}
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
    browserHistory.replace = jest.fn();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/configuration/',
      body: ProjectAlertRuleConfiguration(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      body: ProjectAlertRule(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: TestStubs.Environments(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/?expand=hasAlertIntegration`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/ownership/`,
      method: 'GET',
      body: {
        fallthrough: false,
        autoAssignment: false,
      },
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/preview/',
      method: 'POST',
      body: [],
    });
    ProjectsStore.loadInitialData([TestStubs.Project()]);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    ProjectsStore.reset();
  });

  describe('Viewing the rule', () => {
    it('is visible without org-level alerts:write', async () => {
      createWrapper({
        organization: {access: []},
        project: {access: []},
      });

      expect(await screen.findByText(permissionAlertText)).toBeInTheDocument();
      expect(screen.queryByLabelText('Save Rule')).toBeDisabled();
    });

    it('is enabled with org-level alerts:write', async () => {
      createWrapper({
        organization: {access: ['alerts:write']},
        project: {access: []},
      });

      expect(await screen.findByLabelText('Save Rule')).toBeEnabled();
      expect(screen.queryByText(permissionAlertText)).not.toBeInTheDocument();
    });

    it('is enabled with project-level alerts:write', async () => {
      createWrapper({
        organization: {access: []},
        project: {access: ['alerts:write']},
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
        body: ProjectAlertRule(),
      });
    });

    it('gets correct rule name', async function () {
      const rule = ProjectAlertRule();
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
      createWrapper();
      renderGlobalModal();
      await userEvent.click(screen.getByLabelText('Delete Rule'));

      expect(
        await screen.findByText(/Are you sure you want to delete "My alert rule"\?/)
      ).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => expect(deleteMock).toHaveBeenCalled());
      expect(browserHistory.replace).toHaveBeenCalledWith(
        '/settings/org-slug/projects/project-slug/alerts/'
      );
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
      expect(metric.startTransaction).toHaveBeenCalledTimes(1);
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
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
      expect(metric.startTransaction).toHaveBeenCalledTimes(1);
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('updates the alert onboarding task', async function () {
      createWrapper();
      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => expect(updateOnboardingTask).toHaveBeenCalledTimes(1));
      expect(metric.startTransaction).toHaveBeenCalledTimes(1);
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
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
      await selectEvent.select(screen.getByText('Add action...'), 'Threads');
      await selectEvent.select(screen.getByText('Add action...'), 'Linear');

      expect(screen.getByText('Create a Linear issue with these')).toBeInTheDocument();
      expect(
        screen.getByText('Post to a Threads channel with these')
      ).toBeInTheDocument();
    });

    it('opts out of the alert being disabled', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/1/',
        body: ProjectAlertRule({
          status: 'disabled',
          disableDate: moment().add(1, 'day').toISOString(),
        }),
      });
      createWrapper();
      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() =>
        expect(mock).toHaveBeenCalledWith(
          endpoint,
          expect.objectContaining({
            data: expect.objectContaining({optOutEdit: true}),
          })
        )
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
      MockApiClient.clearMockResponses();
    });

    it('success status updates the rule', async function () {
      const mockSuccess = MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/rule-task/${uuid}/`,
        body: {status: 'success', rule: ProjectAlertRule({name: 'Slack Rule'})},
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/1/',
        method: 'PUT',
        statusCode: 202,
        body: {uuid},
      });
      const {router} = createWrapper();
      await userEvent.click(screen.getByText('Save Rule'), {delay: null});

      await waitFor(() => expect(addLoadingMessage).toHaveBeenCalledTimes(2));
      jest.advanceTimersByTime(1000);

      await waitFor(() => expect(mockSuccess).toHaveBeenCalledTimes(1));
      jest.advanceTimersByTime(1000);
      await waitFor(() => expect(addSuccessMessage).toHaveBeenCalledTimes(1));
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
      await userEvent.click(screen.getByText('Save Rule'), {delay: null});

      await waitFor(() => expect(addLoadingMessage).toHaveBeenCalledTimes(2));
      jest.advanceTimersByTime(1000);

      await waitFor(() => expect(pollingMock).toHaveBeenCalledTimes(1));

      expect(screen.getByTestId('loading-mask')).toBeInTheDocument();
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
      await userEvent.click(screen.getByText('Save Rule'), {delay: null});

      await waitFor(() => expect(addLoadingMessage).toHaveBeenCalledTimes(2));
      jest.advanceTimersByTime(1000);

      await waitFor(() => expect(mockFailed).toHaveBeenCalledTimes(1));
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
      expect(addErrorMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Duplicate Rule', function () {
    let mock;
    const rule = ProjectAlertRule();
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
      expect(screen.queryByText('A new issue is created')).toBeInTheDocument();
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
