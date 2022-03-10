import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {metric} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import AlertsContainer from 'sentry/views/alerts';
import AlertBuilderProjectProvider from 'sentry/views/alerts/builder/projectProvider';
import ProjectAlertsCreate from 'sentry/views/alerts/create';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/members');
jest.mock('react-router');
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
  trackAdvancedAnalyticsEvent: jest.fn(),
}));
jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('ProjectAlertsCreate', function () {
  TeamStore.loadInitialData([], false, null);

  beforeEach(function () {
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const createWrapper = (props = {}, location = {}) => {
    const {organization, project, router} = initializeOrg(props);
    ProjectsStore.loadInitialData([project]);
    const params = {orgId: organization.slug, projectId: project.slug};
    const wrapper = mountWithTheme(
      <AlertsContainer>
        <AlertBuilderProjectProvider params={params}>
          <ProjectAlertsCreate
            params={params}
            location={{
              pathname: `/organizations/org-slug/alerts/rules/${project.slug}/new/`,
              query: {createFromWizard: true},
              ...location,
            }}
            router={router}
          />
        </AlertBuilderProjectProvider>
      </AlertsContainer>,
      {organization}
    );

    return {
      wrapper,
      organization,
      project,
      router,
    };
  };

  it('redirects to wizard', function () {
    const location = {query: {}};
    createWrapper(undefined, location);

    expect(browserHistory.replace).toHaveBeenCalledWith(
      '/organizations/org-slug/alerts/project-slug/wizard'
    );
  });

  describe('Issue Alert', function () {
    it('loads default values', function () {
      createWrapper();

      expect(screen.getByDisplayValue('__all_environments__')).toBeInTheDocument();
      expect(screen.getByDisplayValue('all')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    it('can remove filters', async function () {
      createWrapper({
        organization: {
          features: ['alert-filters'],
        },
      });
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

      // Add a filter and remove it
      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue is {comparison_type} than {value} {time}',
      ]);

      userEvent.click(screen.getByLabelText('Delete Node'));

      userEvent.click(screen.getByText('Save Rule'));

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

    it('can remove conditions', async function () {
      const {organization} = createWrapper({
        organization: {
          features: ['alert-filters'],
        },
      });
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

      // Add a condition and remove it
      await selectEvent.select(screen.getByText('Add optional condition...'), [
        'A new issue is created',
      ]);

      userEvent.click(screen.getByLabelText('Delete Node'));

      expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
        'edit_alert_rule.add_row',
        {
          name: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
          organization,
          project_id: '2',
          type: 'conditions',
        }
      );

      userEvent.click(screen.getByText('Save Rule'));

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

    it('can remove actions', async function () {
      createWrapper({
        organization: {
          features: ['alert-filters'],
        },
      });
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

      // Add an action and remove it
      await selectEvent.select(screen.getByText('Add action...'), [
        'Send a notification (for all legacy integrations)',
      ]);

      userEvent.click(screen.getByLabelText('Delete Node'));

      userEvent.click(screen.getByText('Save Rule'));

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

    it('updates values and saves', async function () {
      const {router} = createWrapper({
        organization: {
          features: ['alert-filters'],
        },
      });
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change target environment
      await selectEvent.select(screen.getByText('All Environments'), ['production']);

      // Change actionMatch and filterMatch dropdown
      const allDropdowns = screen.getAllByText('all');
      expect(allDropdowns).toHaveLength(2);
      await selectEvent.select(allDropdowns[0], ['any']);
      await selectEvent.select(allDropdowns[1], ['any']);

      // `userEvent.paste` isn't really ideal, but since `userEvent.type` doesn't provide good performance and
      // the purpose of this test is not focused on how the user interacts with the fields,
      // but rather on whether the form will be saved and updated, we decided use `userEvent.paste`
      // so that this test does not time out from the default jest value of 5000ms

      // Change name of alert rule
      userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

      // Add another condition
      await selectEvent.select(screen.getByText('Add optional condition...'), [
        "An event's tags match {key} {match} {value}",
      ]);
      // Edit new Condition
      userEvent.paste(screen.getByPlaceholderText('key'), 'conditionKey');

      userEvent.paste(screen.getByPlaceholderText('value'), 'conditionValue');
      await selectEvent.select(screen.getByText('equals'), ['does not equal']);

      // Add a new filter
      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue is {comparison_type} than {value} {time}',
      ]);
      userEvent.paste(screen.getByPlaceholderText('10'), '12');

      // Add a new action
      await selectEvent.select(screen.getByText('Add action...'), [
        'Send a notification via {service}',
      ]);

      // Update action interval
      await selectEvent.select(screen.getByText('30 minutes'), ['60 minutes']);

      userEvent.click(screen.getByText('Save Rule'));

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
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/organizations/org-slug/alerts/rules/',
          query: {project: '2'},
        });
      });
    });
  });
});
