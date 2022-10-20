import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';

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
}));

const projectAlertRuleDetailsRoutes = [
  {
    path: '/',
  },
  {
    path: '/settings/',
    name: 'Settings',
    indexRoute: {},
  },
  {
    name: 'Organization',
    path: ':orgId/',
  },
  {
    name: 'Project',
    path: 'projects/:projectId/',
  },
  {},
  {
    indexRoute: {name: 'General'},
  },
  {
    name: 'Alert Rules',
    path: 'alerts/',
    indexRoute: {},
  },
  {
    path: 'rules/',
    name: 'Rules',
    component: null,
    indexRoute: {},
    childRoutes: [
      {path: 'new/', name: 'New'},
      {path: ':ruleId/', name: 'Edit'},
    ],
  },
  {path: ':ruleId/', name: 'Edit Alert Rule'},
];

const createWrapper = (props = {}) => {
  const {organization, project, routerContext, router} = initializeOrg(props);
  const params = {
    orgId: organization.slug,
    projectId: project.slug,
    ruleId: router.location.query.createFromDuplicate ? undefined : '1',
  };
  const onChangeTitleMock = jest.fn();
  const wrapper = render(
    <ProjectAlerts organization={organization} params={params}>
      <IssueRuleEditor
        params={params}
        location={router.location}
        routes={projectAlertRuleDetailsRoutes}
        router={router}
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
  };
};

describe('IssueRuleEditor', function () {
  beforeEach(function () {
    browserHistory.replace = jest.fn();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/configuration/',
      body: TestStubs.ProjectAlertRuleConfiguration(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      body: TestStubs.ProjectAlertRule(),
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
    ProjectsStore.loadInitialData([TestStubs.Project()]);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    ProjectsStore.reset();
  });

  describe('Edit Rule', function () {
    let mock;
    const endpoint = '/projects/org-slug/project-slug/rules/1/';
    beforeEach(function () {
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'PUT',
        body: TestStubs.ProjectAlertRule(),
      });
    });

    it('gets correct rule name', function () {
      const rule = TestStubs.ProjectAlertRule();
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'GET',
        body: rule,
      });
      const {onChangeTitleMock} = createWrapper();
      expect(mock).toHaveBeenCalled();
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
      userEvent.click(screen.getByLabelText('Delete Rule'));

      expect(
        await screen.findByText('Are you sure you want to delete this rule?')
      ).toBeInTheDocument();
      userEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => expect(deleteMock).toHaveBeenCalled());
      expect(browserHistory.replace).toHaveBeenCalledWith(
        '/settings/org-slug/projects/project-slug/alerts/'
      );
    });

    it('sends correct environment value', async function () {
      createWrapper();
      await selectEvent.select(screen.getByText('staging'), 'production');
      userEvent.click(screen.getByText('Save Rule'));

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
      userEvent.click(screen.getByText('Save Rule'));

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
      userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => expect(updateOnboardingTask).toHaveBeenCalledTimes(1));
      expect(metric.startTransaction).toHaveBeenCalledTimes(1);
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
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
        body: {status: 'success', rule: TestStubs.ProjectAlertRule({name: 'Slack Rule'})},
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/1/',
        method: 'PUT',
        statusCode: 202,
        body: {uuid},
      });
      createWrapper();
      userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => expect(addLoadingMessage).toHaveBeenCalledTimes(2));
      jest.advanceTimersByTime(1000);

      await waitFor(() => expect(mockSuccess).toHaveBeenCalledTimes(1));
      jest.advanceTimersByTime(1000);
      await waitFor(() => expect(addSuccessMessage).toHaveBeenCalledTimes(1));
      expect(screen.getByDisplayValue('Slack Rule')).toBeInTheDocument();
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
      userEvent.click(screen.getByText('Save Rule'));

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
      userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => expect(addLoadingMessage).toHaveBeenCalledTimes(2));
      jest.advanceTimersByTime(1000);

      await waitFor(() => expect(mockFailed).toHaveBeenCalledTimes(1));
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
      expect(addErrorMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Duplicate Rule', function () {
    let mock;
    const rule = TestStubs.ProjectAlertRule();
    const endpoint = `/projects/org-slug/project-slug/rules/${rule.id}/`;

    beforeEach(function () {
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'GET',
        body: rule,
      });
    });

    it('gets correct rule to duplicate and renders fields correctly', function () {
      createWrapper({
        organization: {
          access: ['alerts:write'],
        },
        router: {
          location: {
            query: {
              createFromDuplicate: true,
              duplicateRuleId: `${rule.id}`,
            },
          },
        },
      });
      expect(mock).toHaveBeenCalled();
      expect(screen.getByTestId('alert-name')).toHaveValue(`${rule.name} copy`);
    });
  });
});
