import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {
  cleanup,
  fireEvent,
  mountWithTheme,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as memberActionCreators from 'app/actionCreators/members';
import ProjectsStore from 'app/stores/projectsStore';
import {metric, trackAnalyticsEvent} from 'app/utils/analytics';
import AlertsContainer from 'app/views/alerts';
import AlertBuilderProjectProvider from 'app/views/alerts/builder/projectProvider';
import ProjectAlertsCreate from 'app/views/alerts/create';

jest.unmock('app/utils/recreateRoute');
jest.mock('app/utils/analytics', () => ({
  metric: {
    startTransaction: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    endTransaction: jest.fn(),
    mark: jest.fn(),
    measure: jest.fn(),
  },
  trackAnalyticsEvent: jest.fn(),
}));

describe('ProjectAlertsCreate', function () {
  const projectAlertRuleDetailsRoutes = [
    {
      path: '/organizations/:orgId/alerts/',
      name: 'Organization Alerts',
      indexRoute: {},
      childRoutes: [
        {
          path: 'rules/',
          name: 'Rules',
          childRoutes: [
            {
              name: 'Project',
              path: ':projectId/',
              childRoutes: [
                {
                  name: 'New Alert Rule',
                  path: 'new/',
                },
                {
                  name: 'Edit Alert Rule',
                  path: ':ruleId/',
                },
              ],
            },
          ],
        },
        {
          path: 'metric-rules',
          name: 'Metric Rules',
          childRoutes: [
            {
              name: 'Project',
              path: ':projectId/',
              childRoutes: [
                {
                  name: 'New Alert Rule',
                  path: 'new/',
                },
                {
                  name: 'Edit Alert Rule',
                  path: ':ruleId/',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'Project',
      path: ':projectId/',
    },
    {
      name: 'New Alert Rule',
      path: 'new/',
    },
  ];

  beforeEach(function () {
    memberActionCreators.fetchOrgMembers = jest.fn();
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
      url: '/organizations/org-slug/users/',
      body: [TestStubs.User()],
    });
    metric.startTransaction.mockClear();
  });

  afterEach(function () {
    cleanup();
    MockApiClient.clearMockResponses();
    trackAnalyticsEvent.mockClear();
  });

  const createWrapper = (props = {}) => {
    const {organization, project, routerContext, router} = initializeOrg(props);
    ProjectsStore.loadInitialData([project]);
    const params = {orgId: organization.slug, projectId: project.slug};
    const wrapper = mountWithTheme(
      <AlertsContainer organization={organization} params={params}>
        <AlertBuilderProjectProvider params={params}>
          <ProjectAlertsCreate
            params={params}
            location={{
              pathname: `/organizations/org-slug/alerts/rules/${project.slug}/new/`,
            }}
            routes={projectAlertRuleDetailsRoutes}
            router={router}
          />
        </AlertBuilderProjectProvider>
      </AlertsContainer>,
      {context: routerContext}
    );
    mockRouterPush(wrapper, router);

    return {
      wrapper,
      organization,
      project,
      router,
    };
  };

  describe('Issue Alert', function () {
    it('loads default values', async function () {
      const {
        wrapper: {getByDisplayValue},
      } = createWrapper();

      await waitFor(() => {
        expect(getByDisplayValue('__all_environments__')).toBeInTheDocument();
      });
      expect(getByDisplayValue('all')).toBeInTheDocument();
      expect(getByDisplayValue('30')).toBeInTheDocument();
    });

    it('can remove filters, conditions and actions', async function () {
      const {
        wrapper: {getByLabelText, getByPlaceholderText, getByText},
      } = createWrapper({
        organization: {
          features: ['alert-filters'],
        },
      });
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      await waitFor(() => {
        expect(memberActionCreators.fetchOrgMembers).toHaveBeenCalled();
      });

      // Change name of alert rule
      fireEvent.change(getByPlaceholderText('My Rule Name'), {
        target: {value: 'My Rule Name'},
      });

      // Add a condition and remove it
      await selectEvent.select(getByText('Add optional condition...'), [
        'A new issue is created',
      ]);
      fireEvent.click(getByLabelText('Delete Node'));

      expect(trackAnalyticsEvent).toHaveBeenCalledWith({
        eventKey: 'edit_alert_rule.add_row',
        eventName: 'Edit Alert Rule: Add Row',
        name: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
        organization_id: '3',
        project_id: '2',
        type: 'conditions',
      });

      // Add a filter and remove it
      await selectEvent.select(getByText('Add optional filter...'), [
        'The issue is {comparison_type} than {value} {time}',
      ]);
      fireEvent.click(getByLabelText('Delete Node'));

      // Add an action and remove it
      await selectEvent.select(getByText('Add action...'), [
        'Send a notification (for all legacy integrations)',
      ]);
      fireEvent.click(getByLabelText('Delete Node'));

      fireEvent.click(getByText('Save Rule'));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'all',
              actions: [],
              conditions: [],
              filterMatch: 'all',
              filters: [],
              frequency: 30,
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
      });
    });

    it('updates values and saves', async function () {
      const {
        wrapper: {getAllByText, getByPlaceholderText, getByText},
        router,
      } = createWrapper({
        organization: {
          features: ['alert-filters'],
        },
      });
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      await waitFor(() => {
        expect(memberActionCreators.fetchOrgMembers).toHaveBeenCalled();
      });

      // Change target environment
      await selectEvent.select(getByText('All Environments'), ['production']);

      // Change actionMatch and filterMatch dropdown
      await selectEvent.select(getAllByText('all')[0], ['any']);
      await selectEvent.select(getAllByText('all')[0], ['any']);

      // Change name of alert rule
      fireEvent.change(getByPlaceholderText('My Rule Name'), {
        target: {value: 'My Rule Name'},
      });

      // Add another condition
      await selectEvent.select(getByText('Add optional condition...'), [
        "An event's tags match {key} {match} {value}",
      ]);
      // Edit new Condition
      fireEvent.change(getByPlaceholderText('key'), {
        target: {value: 'conditionKey'},
      });
      fireEvent.change(getByPlaceholderText('value'), {
        target: {value: 'conditionValue'},
      });
      await selectEvent.select(getByText('equals'), ['does not equal']);

      // Add a new filter
      await selectEvent.select(getByText('Add optional filter...'), [
        'The issue is {comparison_type} than {value} {time}',
      ]);
      fireEvent.change(getByPlaceholderText('10'), {
        target: {value: '12'},
      });

      // Add a new action
      await selectEvent.select(getByText('Add action...'), [
        'Send a notification via {service}',
      ]);

      // Update action interval
      await selectEvent.select(getByText('30 minutes'), ['60 minutes']);

      fireEvent.click(getByText('Save Rule'));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              filterMatch: 'any',
              actions: [
                {
                  id: 'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',
                  service: 'mail',
                },
              ],
              conditions: [
                {
                  id: 'sentry.rules.conditions.tagged_event.TaggedEventCondition',
                  key: 'conditionKey',
                  match: 'ne',
                  value: 'conditionValue',
                },
              ],
              filters: [
                {
                  id: 'sentry.rules.filters.age_comparison.AgeComparisonFilter',
                  comparison_type: 'older',
                  time: 'minute',
                  value: '12',
                },
              ],
              environment: 'production',
              frequency: '60',
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
      });
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});

      expect(router.push).toHaveBeenCalledWith('/organizations/org-slug/alerts/rules/');
    });
  });
});
