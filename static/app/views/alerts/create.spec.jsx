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
// updateOnboardingTask triggers an out of band state update
jest.mock('sentry/actionCreators/onboardingTasks');
jest.mock('sentry/actionCreators/members', () => ({
  fetchOrgMembers: jest.fn(() => Promise.resolve([])),
  indexMembersByProject: jest.fn(() => {
    return {};
  }),
}));
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
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/ownership/`,
      method: 'GET',
      body: {
        fallthrough: false,
        autoAssignment: false,
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const createWrapper = (props = {}, location = {}) => {
    const {organization, project, router, routerContext} = initializeOrg(props);
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
      {organization, context: routerContext}
    );

    return {
      wrapper,
      organization,
      project,
      router,
    };
  };

  it('adds default parameters if wizard was skipped', async function () {
    const location = {query: {}};
    const wrapper = createWrapper(undefined, location);
    await waitFor(() => {
      expect(wrapper.router.replace).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/alerts/new/metric',
        query: {
          aggregate: 'count()',
          dataset: 'events',
          eventTypes: 'error',
          project: 'project-slug',
        },
      });
    });
  });

  describe('Issue Alert', function () {
    it('loads default values', async function () {
      createWrapper();
      expect(await screen.findByText('All Environments')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getAllByText('all')).toHaveLength(2);
      });
      await waitFor(() => {
        expect(screen.getByText('24 hours')).toBeInTheDocument();
      });
    });

    it('can remove filters', async function () {
      createWrapper();
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'My Rule Name');

      // Add a filter and remove it
      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue is older or newer than...',
      ]);

      await userEvent.click(screen.getByLabelText('Delete Node'));

      await userEvent.click(screen.getByText('Save Rule'));

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
              frequency: 60 * 24,
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
      });
    });

    it('can remove triggers', async function () {
      const {organization} = createWrapper();
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'My Rule Name');

      // Add a trigger and remove it
      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);

      await userEvent.click(screen.getByLabelText('Delete Node'));

      await waitFor(() => {
        expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
          'edit_alert_rule.add_row',
          {
            name: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
            organization,
            project_id: '2',
            type: 'conditions',
          }
        );
      });

      await userEvent.click(screen.getByText('Save Rule'));

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
              frequency: 60 * 24,
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
      });
    });

    it('can remove actions', async function () {
      createWrapper();
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      // Change name of alert rule
      await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'My Rule Name');

      // Add an action and remove it
      await selectEvent.select(screen.getByText('Add action...'), [
        'Send a notification to all legacy integrations',
      ]);

      await userEvent.click(screen.getByLabelText('Delete Node'));

      await userEvent.click(screen.getByText('Save Rule'));

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
              frequency: 60 * 24,
              name: 'My Rule Name',
              owner: null,
            },
          })
        );
      });
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

      it('environment, async action and filter match', async function () {
        const wrapper = createWrapper();

        // Change target environment
        await selectEvent.select(screen.getByText('All Environments'), ['production']);

        // Change actionMatch and filterMatch dropdown
        const allDropdowns = screen.getAllByText('all');
        expect(allDropdowns).toHaveLength(2);
        await selectEvent.select(allDropdowns[0], ['any']);
        await selectEvent.select(allDropdowns[1], ['any']);

        // Change name of alert rule
        await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'My Rule Name');

        await userEvent.click(screen.getByText('Save Rule'));

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
              frequency: 60 * 24,
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
        await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'My Rule Name');

        // Add another condition
        await selectEvent.select(screen.getByText('Add optional filter...'), [
          "The event's tags match {key} {match} {value}",
        ]);
        // Edit new Condition
        await userEvent.paste(screen.getByPlaceholderText('key'), 'conditionKey');
        await userEvent.paste(screen.getByPlaceholderText('value'), 'conditionValue');
        await selectEvent.select(screen.getByText('contains'), ['does not equal']);

        await userEvent.click(screen.getByText('Save Rule'));

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
              frequency: 60 * 24,
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
        await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'My Rule Name');

        // Add a new filter
        await selectEvent.select(screen.getByText('Add optional filter...'), [
          'The issue is older or newer than...',
        ]);
        await userEvent.paste(screen.getByPlaceholderText('10'), '12');

        await userEvent.click(screen.getByText('Save Rule'));

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
              frequency: 60 * 24,
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
        await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'My Rule Name');

        // Add a new action
        await selectEvent.select(screen.getByText('Add action...'), [
          'Issue Owners, Team, or Member',
        ]);

        // Update action interval
        await selectEvent.select(screen.getByText('24 hours'), ['60 minutes']);

        await userEvent.click(screen.getByText('Save Rule'));

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

  describe('test preview chart', () => {
    const organization = TestStubs.Organization({features: ['issue-alert-preview']});
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('valid preview table', async () => {
      const groups = TestStubs.Groups();
      const date = new Date();
      for (let i = 0; i < groups.length; i++) {
        groups[i].lastTriggered = date;
      }
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/preview',
        method: 'POST',
        body: groups,
        headers: {
          'X-Hits': groups.length,
          Endpoint: 'endpoint',
        },
      });
      createWrapper({organization});
      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'all',
              conditions: [],
              filterMatch: 'all',
              filters: [],
              frequency: 60 * 24,
              endpoint: null,
            },
          })
        );
      });
      expect(
        screen.getByText('4 issues would have triggered this rule in the past 14 days', {
          exact: false,
        })
      ).toBeInTheDocument();
      for (const group of groups) {
        expect(screen.getByText(group.shortId)).toBeInTheDocument();
      }
      expect(screen.getAllByText('3mo ago')[0]).toBeInTheDocument();

      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);
      await waitFor(() => {
        expect(mock).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: expect.objectContaining({
              endpoint: 'endpoint',
            }),
          })
        );
      });
    });

    it('invalid preview alert', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/preview',
        method: 'POST',
        statusCode: 400,
      });
      createWrapper({organization});
      await waitFor(() => {
        expect(mock).toHaveBeenCalled();
      });
      expect(
        screen.getByText('Select a condition to generate a preview')
      ).toBeInTheDocument();

      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);
      expect(
        screen.getByText('Preview is not supported for these conditions')
      ).toBeInTheDocument();
    });

    it('empty preview table', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/preview',
        method: 'POST',
        body: [],
        headers: {
          'X-Hits': 0,
          Endpoint: 'endpoint',
        },
      });
      createWrapper({organization});
      await waitFor(() => {
        expect(mock).toHaveBeenCalled();
      });
      expect(
        screen.getByText("We couldn't find any issues that would've triggered your rule")
      ).toBeInTheDocument();
    });
  });

  describe('test incompatible conditions', () => {
    const organization = TestStubs.Organization({
      features: ['issue-alert-incompatible-rules'],
    });
    const errorText =
      'The conditions highlighted in red are in conflict. They may prevent the alert from ever being triggered.';

    it('shows error for incompatible conditions', async () => {
      createWrapper({organization});
      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);
      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'The issue changes state from resolved to unresolved',
      ]);
      expect(screen.getByText(errorText)).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Save Rule'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.click(screen.getAllByLabelText('Delete Node')[0]);
      expect(screen.queryByText(errorText)).not.toBeInTheDocument();
    });

    it('test any filterMatch', async () => {
      createWrapper({organization});
      const allDropdowns = screen.getAllByText('all');
      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);

      await selectEvent.select(allDropdowns[1], ['any']);
      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue is older or newer than...',
      ]);

      await userEvent.paste(screen.getByPlaceholderText('10'), '10');
      await userEvent.click(document.body);

      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue has happened at least {x} times (Note: this is approximate)',
      ]);

      expect(screen.getByText(errorText)).toBeInTheDocument();

      await userEvent.click(screen.getAllByLabelText('Delete Node')[1]);
      await userEvent.clear(screen.getByDisplayValue('10'));
      await userEvent.click(document.body);

      expect(screen.queryByText(errorText)).not.toBeInTheDocument();
    });
  });
});
