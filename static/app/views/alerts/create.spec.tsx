import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {GroupsFixture} from 'sentry-fixture/groups';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectAlertRuleFixture} from 'sentry-fixture/projectAlertRule';
import {ProjectAlertRuleConfigurationFixture} from 'sentry-fixture/projectAlertRuleConfiguration';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {metric, trackAnalytics} from 'sentry/utils/analytics';
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

describe('ProjectAlertsCreate', function () {
  beforeEach(function () {
    TeamStore.init();
    TeamStore.loadInitialData([], false, null);
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
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const createWrapper = (props = {}, location = {}) => {
    const {organization, project, router} = initializeOrg(props);
    ProjectsStore.loadInitialData([project]);
    const params = {orgId: organization.slug, projectId: project.slug};
    const wrapper = render(
      <AlertsContainer>
        <AlertBuilderProjectProvider
          {...RouteComponentPropsFixture()}
          params={params}
          organization={organization}
          hasMetricAlerts={false}
        >
          <ProjectAlertsCreate
            {...RouteComponentPropsFixture()}
            hasMetricAlerts={false}
            members={[]}
            params={params}
            organization={organization}
            project={project}
            location={LocationFixture({
              pathname: `/organizations/org-slug/alerts/rules/${project.slug}/new/`,
              query: {createFromWizard: 'true'},
              ...location,
            })}
            router={router}
          />
        </AlertBuilderProjectProvider>
      </AlertsContainer>,
      {organization, router}
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
      expect(wrapper.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/alerts/new/metric',
          query: {
            aggregate: 'count()',
            dataset: 'events',
            eventTypes: 'error',
            project: 'project-slug',
          },
        })
      );
    });
  });

  describe('Issue Alert', function () {
    it('loads default values', async function () {
      createWrapper();
      expect(await screen.findByText('All Environments')).toBeInTheDocument();
      expect(await screen.findByText('any')).toBeInTheDocument();
      expect(await screen.findByText('all')).toBeInTheDocument();
      expect(await screen.findByText('24 hours')).toBeInTheDocument();
    });

    it('can remove filters', async function () {
      createWrapper();
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: ProjectAlertRuleFixture(),
      });

      // Change name of alert rule
      await userEvent.type(screen.getByPlaceholderText('Enter Alert Name'), 'myname');

      // Add a filter and remove it
      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue is older or newer than...',
      ]);

      await userEvent.click(screen.getAllByLabelText('Delete Node')[1]!);

      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              actions: [],
              conditions: [
                expect.objectContaining({
                  id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
                }),
              ],
              filterMatch: 'all',
              filters: [],
              frequency: 60 * 24,
              name: 'myname',
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
        body: ProjectAlertRuleFixture(),
      });
      // delete node
      await userEvent.click(screen.getAllByLabelText('Delete Node')[0]!);

      // Change name of alert rule
      await userEvent.type(screen.getByPlaceholderText('Enter Alert Name'), 'myname');

      // Add a trigger and remove it
      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);

      await userEvent.click(screen.getByLabelText('Delete Node'));

      await waitFor(() => {
        expect(trackAnalytics).toHaveBeenCalledWith('edit_alert_rule.add_row', {
          name: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
          organization,
          project_id: '2',
          type: 'conditions',
        });
      });

      await waitFor(() => {
        expect(trackAnalytics).toHaveBeenCalledWith('edit_alert_rule.delete_row', {
          name: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
          organization,
          project_id: '2',
          type: 'conditions',
        });
      });

      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              actions: [],
              conditions: [],
              filterMatch: 'all',
              filters: [],
              frequency: 60 * 24,
              name: 'myname',
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
        body: ProjectAlertRuleFixture(),
      });

      // Change name of alert rule
      await userEvent.type(screen.getByPlaceholderText('Enter Alert Name'), 'myname');

      // Add an action and remove it
      await selectEvent.select(screen.getByText('Add action...'), [
        'Send a notification to all legacy integrations',
      ]);

      await userEvent.click(screen.getAllByLabelText('Delete Node')[1]!);

      await userEvent.click(screen.getByText('Save Rule'));

      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              actions: [],
              conditions: [
                expect.objectContaining({
                  id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
                }),
              ],
              filterMatch: 'all',
              filters: [],
              frequency: 60 * 24,
              name: 'myname',
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
          body: ProjectAlertRuleFixture(),
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
        const anyDropdown = screen.getByText('any');
        expect(anyDropdown).toBeInTheDocument();
        const allDropdown = screen.getByText('all');
        expect(allDropdown).toBeInTheDocument();

        await selectEvent.select(anyDropdown, ['all']);
        await selectEvent.select(allDropdown, ['any']);

        // Change name of alert rule
        await userEvent.type(screen.getByPlaceholderText('Enter Alert Name'), 'myname');

        await userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'all',
              filterMatch: 'any',
              conditions: [
                expect.objectContaining({
                  id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
                }),
              ],
              actions: [],
              filters: [],
              environment: 'production',
              frequency: 60 * 24,
              name: 'myname',
              owner: null,
            },
          })
        );
        expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });

      it('new condition', async function () {
        const wrapper = createWrapper();

        // Change name of alert rule
        await userEvent.click(screen.getByPlaceholderText('Enter Alert Name'));
        await userEvent.paste('myname');

        // Add another condition
        await selectEvent.select(screen.getByText('Add optional filter...'), [
          "The event's tags match {key} {match} {value}",
        ]);
        // Edit new Condition
        await userEvent.click(screen.getByPlaceholderText('key'));
        await userEvent.paste('conditionKey');
        await userEvent.click(screen.getByPlaceholderText('value'));
        await userEvent.paste('conditionValue');
        await selectEvent.select(screen.getByText('contains'), ['does not equal']);

        await userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              actions: [],
              conditions: [
                expect.objectContaining({
                  id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
                }),
              ],
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
              name: 'myname',
              owner: null,
            },
          })
        );
        expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });

      it('new filter', async function () {
        const wrapper = createWrapper();

        // Change name of alert rule
        await userEvent.click(screen.getByPlaceholderText('Enter Alert Name'));
        await userEvent.paste('myname');
        // delete one condition
        await userEvent.click(screen.getAllByLabelText('Delete Node')[0]!);

        // Add a new filter
        await selectEvent.select(screen.getByText('Add optional filter...'), [
          'The issue is older or newer than...',
        ]);
        await userEvent.click(screen.getByPlaceholderText('10'));
        await userEvent.paste('12');

        await userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
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
              name: 'myname',
              owner: null,
            },
          })
        );
        expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });

      it('new action', async function () {
        const wrapper = createWrapper();

        // Change name of alert rule
        await userEvent.type(screen.getByPlaceholderText('Enter Alert Name'), 'myname');

        // Add a new action
        await selectEvent.select(screen.getByText('Add action...'), [
          'Suggested Assignees, Team, or Member',
        ]);

        // Update action interval
        await selectEvent.select(screen.getByText('24 hours'), ['60 minutes']);

        await userEvent.click(screen.getByText('Save Rule'));

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              actions: [
                {id: 'sentry.mail.actions.NotifyEmailAction', targetType: 'IssueOwners'},
              ],
              conditions: [
                expect.objectContaining({
                  id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
                }),
              ],
              filterMatch: 'all',
              filters: [],
              frequency: '60',
              name: 'myname',
              owner: null,
            },
          })
        );
        expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});

        await waitFor(() => {
          expect(wrapper.router.push).toHaveBeenCalledWith({
            pathname: '/organizations/org-slug/alerts/rules/project-slug/1/details/',
          });
        });
      });
    });
  });

  describe('test preview chart', () => {
    it('valid preview table', async () => {
      const groups = GroupsFixture();
      const date = new Date();
      for (let i = 0; i < groups.length; i++) {
        groups[i]!.lastTriggered = String(date);
      }
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/preview/',
        method: 'POST',
        body: groups,
        headers: {
          'X-Hits': String(groups.length),
          Endpoint: 'endpoint',
        },
      });
      createWrapper();
      await waitFor(() => {
        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              conditions: [
                expect.objectContaining({
                  id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
                }),
              ],
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
    });

    it('invalid preview alert', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/preview/',
        method: 'POST',
        statusCode: 400,
      });
      createWrapper();
      // delete existion conditions
      await userEvent.click(screen.getAllByLabelText('Delete Node')[0]!);

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
        await screen.findByText('Preview is not supported for these conditions')
      ).toBeInTheDocument();
    });

    it('empty preview table', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/preview/',
        method: 'POST',
        body: [],
        headers: {
          'X-Hits': '0',
          Endpoint: 'endpoint',
        },
      });
      createWrapper();
      await waitFor(() => {
        expect(mock).toHaveBeenCalled();
      });
      expect(
        screen.getByText("We couldn't find any issues that would've triggered your rule")
      ).toBeInTheDocument();
    });
  });

  describe('test incompatible conditions', () => {
    const errorText =
      'The conditions highlighted in red are in conflict. They may prevent the alert from ever being triggered.';

    it('shows error for incompatible conditions', async () => {
      createWrapper();
      await userEvent.click(screen.getAllByLabelText('Delete Node')[0]!);

      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);

      const anyDropdown = screen.getByText('any');
      expect(anyDropdown).toBeInTheDocument();
      await selectEvent.select(anyDropdown, ['all']);

      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'The issue changes state from resolved to unresolved',
      ]);
      expect(screen.getByText(errorText)).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Save Rule'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.click(screen.getAllByLabelText('Delete Node')[0]!);
      expect(screen.queryByText(errorText)).not.toBeInTheDocument();
    });

    it('test any filterMatch', async () => {
      createWrapper();
      await userEvent.click(screen.getAllByLabelText('Delete Node')[0]!);

      await selectEvent.select(screen.getByText('Add optional trigger...'), [
        'A new issue is created',
      ]);

      const allDropdown = screen.getByText('all');
      await selectEvent.select(allDropdown, ['any']);
      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue is older or newer than...',
      ]);

      await userEvent.type(screen.getByPlaceholderText('10'), '10');
      await userEvent.click(document.body);

      await selectEvent.select(screen.getByText('Add optional filter...'), [
        'The issue has happened at least {x} times (Note: this is approximate)',
      ]);

      expect(screen.getByText(errorText)).toBeInTheDocument();

      await userEvent.click(screen.getAllByLabelText('Delete Node')[1]!);
      await userEvent.clear(screen.getByDisplayValue('10'));
      await userEvent.click(document.body);

      expect(screen.queryByText(errorText)).not.toBeInTheDocument();
    });
  });

  it('shows archived to escalating instead of ignored to unresolved', async () => {
    createWrapper({
      organization: OrganizationFixture(),
    });
    await selectEvent.select(screen.getByText('Add optional trigger...'), [
      'The issue changes state from archived to escalating',
    ]);

    expect(
      screen.getByText('The issue changes state from archived to escalating')
    ).toBeInTheDocument();
  });

  it('displays noisy alert checkbox for no conditions + filters', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/',
      method: 'POST',
      body: ProjectAlertRuleFixture(),
    });
    createWrapper();
    await userEvent.click((await screen.findAllByLabelText('Delete Node'))[0]!);

    await selectEvent.select(screen.getByText('Add action...'), [
      'Suggested Assignees, Team, or Member',
    ]);

    expect(
      screen.getByText(/Alerts without conditions can fire too frequently/)
    ).toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'alert_builder.noisy_warning_viewed',
      expect.anything()
    );

    await userEvent.click(screen.getByText('Save Rule'));

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Yes, I don’t mind if this alert gets noisy'})
    );
    await userEvent.click(screen.getByText('Save Rule'));

    expect(mock).toHaveBeenCalled();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'alert_builder.noisy_warning_agreed',
      expect.anything()
    );
  });

  it('does not display noisy alert banner for legacy integrations', async function () {
    createWrapper();
    await userEvent.click((await screen.findAllByLabelText('Delete Node'))[0]!);

    await selectEvent.select(screen.getByText('Add action...'), [
      'Send a notification to all legacy integrations',
    ]);

    expect(
      screen.queryByText(/Alerts without conditions can fire too frequently/)
    ).not.toBeInTheDocument();

    await selectEvent.select(screen.getByText('Add action...'), [
      'Suggested Assignees, Team, or Member',
    ]);

    expect(
      screen.getByText(/Alerts without conditions can fire too frequently/)
    ).toBeInTheDocument();
  });

  it('displays duplicate error banner with link', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/',
      method: 'POST',
      statusCode: 400,
      body: {
        name: [
          "This rule is an exact duplicate of 'test alert' in this project and may not be created.",
        ],
        ruleId: [1337],
      },
    });

    createWrapper();

    await userEvent.click(screen.getByText('Save Rule'));

    const bannerLink = await screen.findByRole('link', {
      name: /rule fully duplicates "test alert"/,
    });
    expect(bannerLink).toBeInTheDocument();
    expect(bannerLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/alerts/rules/project-slug/1337/details/'
    );
  });
});
