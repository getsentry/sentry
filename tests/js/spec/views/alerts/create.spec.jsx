import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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
  beforeEach(function () {
    TeamStore.init();
    TeamStore.loadInitialData([], false, null);
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
    TeamStore.teardown();
  });

  const createWrapper = (props = {}, location = {}) => {
    const {organization, project, router} = initializeOrg(props);
    ProjectsStore.loadInitialData([project]);
    const params = {orgId: organization.slug, projectId: project.slug};
    const wrapper = render(
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
    const wrapper = createWrapper(undefined, location);

    expect(wrapper.router.replace).toHaveBeenCalledWith(
      '/organizations/org-slug/alerts/project-slug/wizard'
    );
  });

  describe('Issue Alert', function () {
    it('loads default values', function () {
      createWrapper();

      expect(screen.getByDisplayValue('__all_environments__')).toBeInTheDocument();
      expect(screen.getAllByDisplayValue('all')).toHaveLength(2);
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    it('can remove filters', async function () {
      createWrapper();
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

      // Add a filter and remove it
      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue is older or newer than...',
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

    it('can remove triggers', async function () {
      const {organization} = createWrapper();
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

      // Add a trigger and remove it
      await selectEvent.select(screen.getByText('Add optional trigger...'), [
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
      createWrapper();
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

      // Add an action and remove it
      await selectEvent.select(screen.getByText('Add action...'), [
        'Send a notification to all legacy integrations',
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

    describe('updates and saves', function () {
      let mock;

      beforeEach(function () {
        mock = MockApiClient.addMockResponse({
          url: '/projects/org-slug/project-slug/rules/',
          method: 'POST',
          body: TestStubs.ProjectAlertRule(),
        });
      });

      afterEach(function () {
        jest.clearAllMocks();
      });

      it('environment, action and filter match', async function () {
        const wrapper = createWrapper();

        // Change target environment
        await selectEvent.select(screen.getByText('All Environments'), ['production']);

        // Change actionMatch and filterMatch dropdown
        const allDropdowns = screen.getAllByText('all');
        expect(allDropdowns).toHaveLength(2);
        await selectEvent.select(allDropdowns[0], ['any']);
        await selectEvent.select(allDropdowns[1], ['any']);

        // Change name of alert rule
        userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

        userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              filterMatch: 'any',
              conditions: [],
              actions: [],
              filters: [],
              environment: 'production',
              frequency: 30,
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
        expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });

      it('new condition', async function () {
        const wrapper = createWrapper();

        // Change name of alert rule
        userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

        // Add another condition
        await selectEvent.select(screen.getByText('Add optional filter...'), [
          "The event's tags match {key} {match} {value}",
        ]);
        // Edit new Condition
        userEvent.paste(screen.getByPlaceholderText('key'), 'conditionKey');
        userEvent.paste(screen.getByPlaceholderText('value'), 'conditionValue');
        await selectEvent.select(screen.getByText('contains'), ['does not equal']);

        userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'all',
              actions: [],
              conditions: [],
              filterMatch: 'all',
              filters: [
                {
                  id: 'sentry.rules.filters.tagged_event.TaggedEventFilter',
                  key: 'conditionKey',
                  match: 'ne',
                  value: 'conditionValue',
                },
              ],
              frequency: 30,
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
        expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });

      it('new filter', async function () {
        const wrapper = createWrapper();

        // Change name of alert rule
        userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

        // Add a new filter
        await selectEvent.select(screen.getByText('Add optional filter...'), [
          'The issue is older or newer than...',
        ]);
        userEvent.paste(screen.getByPlaceholderText('10'), '12');

        userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'all',
              filterMatch: 'all',
              filters: [
                {
                  id: 'sentry.rules.filters.age_comparison.AgeComparisonFilter',
                  comparison_type: 'older',
                  time: 'minute',
                  value: '12',
                },
              ],
              actions: [],
              conditions: [],
              frequency: 30,
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
        expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });

      it('new action', async function () {
        const wrapper = createWrapper();

        // Change name of alert rule
        userEvent.paste(screen.getByPlaceholderText('My Rule Name'), 'My Rule Name');

        // Add a new action
        await selectEvent.select(screen.getByText('Add action...'), [
          'Issue Owners, Team, or Member',
        ]);

        // Update action interval
        await selectEvent.select(screen.getByText('30 minutes'), ['60 minutes']);

        userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'all',
              actions: [
                {id: 'sentry.mail.actions.NotifyEmailAction', targetType: 'IssueOwners'},
              ],
              conditions: [],
              filterMatch: 'all',
              filters: [],
              frequency: '60',
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
        expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });
    });
  });
});
