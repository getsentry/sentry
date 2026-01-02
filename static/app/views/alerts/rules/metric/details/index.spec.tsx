import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {IncidentFixture} from 'sentry-fixture/incident';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import MetricAlertDetails from 'sentry/views/alerts/rules/metric/details';
import {
  Dataset,
  EventTypes,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

jest.mock('sentry/utils/analytics');

describe('MetricAlertDetails', () => {
  const project = ProjectFixture({slug: 'earth', platform: 'javascript'});
  beforeEach(() => {
    act(() => ProjectsStore.loadInitialData([project]));
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2017-10-17T02%3A41%3A20&groupStatsPeriod=auto&limit=5&project=2&query=event.type%3Aerror&sort=freq&start=2017-10-10T02%3A41%3A20',
      body: [GroupFixture()],
    });
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    const {organization, routerProps} = initializeOrg();
    const incident = IncidentFixture();
    const rule = MetricRuleFixture({
      projects: [project.slug],
      latestIncident: incident,
    });
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: promptResponse,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/alert-rules/${rule.id}/`,
      body: rule,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/`,
      body: [incident],
    });

    render(
      <MetricAlertDetails
        organization={organization}
        {...routerProps}
        params={{ruleId: rule.id}}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText(rule.name)).toBeInTheDocument();
    expect(screen.getByText('Change alert status to Resolved')).toBeInTheDocument();
    expect(screen.getByText(`#${incident.identifier}`)).toBeInTheDocument();
    // Related issues
    expect(screen.getByTestId('group')).toBeInTheDocument();

    expect(trackAnalytics).toHaveBeenCalledWith(
      'alert_rule_details.viewed',
      expect.objectContaining({
        rule_id: Number(rule.id),
        alert: '',
      })
    );
  });

  it('renders selected incident', async () => {
    const {organization, router, routerProps} = initializeOrg();
    const rule = MetricRuleFixture({projects: [project.slug]});
    const incident = IncidentFixture();
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: promptResponse,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/alert-rules/${rule.id}/`,
      body: rule,
    });
    const incidentMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/${incident.id}/`,
      body: incident,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/`,
      body: [incident],
    });
    // Related issues to the selected incident
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2016-04-26T19%3A44%3A05&groupStatsPeriod=auto&limit=5&project=2&query=event.type%3Aerror&sort=freq&start=2016-03-29T19%3A44%3A05',
      body: [GroupFixture()],
    });

    render(
      <MetricAlertDetails
        organization={organization}
        {...routerProps}
        location={{...router.location, query: {alert: incident.id}}}
        params={{ruleId: rule.id}}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText(rule.name)).toBeInTheDocument();
    // Related issues
    expect(screen.getByTestId('group')).toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'alert_rule_details.viewed',
      expect.objectContaining({
        rule_id: Number(rule.id),
        alert: '321',
      })
    );
    expect(incidentMock).toHaveBeenCalled();
    expect(issuesRequest).toHaveBeenCalled();
  });

  it('renders mute button for metric alert', async () => {
    const {organization, routerProps} = initializeOrg();
    const incident = IncidentFixture();
    const rule = MetricRuleFixture({
      projects: [project.slug],
      latestIncident: incident,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/alert-rules/${rule.id}/`,
      body: rule,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/`,
      body: [incident],
    });
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: promptResponse,
    });
    const postRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/alert-rules/${rule.id}/snooze/`,
      method: 'POST',
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/alert-rules/${rule.id}/snooze/`,
      method: 'DELETE',
    });

    render(
      <MetricAlertDetails
        {...routerProps}
        organization={organization}
        params={{ruleId: rule.id}}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText('Mute for everyone')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Mute for everyone'}));
    expect(postRequest).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('Unmute')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Unmute'}));

    expect(deleteRequest).toHaveBeenCalledTimes(1);
  });

  it('renders open in discover button with dataset=errors for is:unresolved query', async () => {
    const {organization, routerProps} = initializeOrg({
      organization: {features: ['discover-basic']},
    });
    const rule = MetricRuleFixture({
      projects: [project.slug],
      dataset: Dataset.ERRORS,
      query: 'is:unresolved',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/alert-rules/${rule.id}/`,
      body: rule,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2017-10-17T02%3A41%3A20&groupStatsPeriod=auto&limit=5&project=2&query=event.type%3Aerror%20is%3Aunresolved&sort=freq&start=2017-10-10T02%3A41%3A20',
      body: [],
    });

    render(
      <MetricAlertDetails
        organization={organization}
        {...routerProps}
        params={{ruleId: rule.id}}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText(rule.name)).toBeInTheDocument();

    const button = screen.getByRole('button', {name: 'Open in Discover'});
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('href', expect.stringContaining('dataset=errors'));
  });

  it('disables duplicate button if deprecation flag is on', async () => {
    const {organization, routerProps} = initializeOrg({
      organization: {
        features: ['discover-basic', 'discover-saved-queries-deprecation'],
      },
    });
    const rule = MetricRuleFixture({
      projects: [project.slug],
      dataset: Dataset.TRANSACTIONS,
      eventTypes: [EventTypes.TRANSACTION],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/alert-rules/${rule.id}/`,
      body: rule,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/`,
      body: [],
    });

    render(
      <MetricAlertDetails
        organization={organization}
        {...routerProps}
        params={{ruleId: rule.id}}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText(rule.name)).toBeInTheDocument();

    expect(await screen.findByRole('button', {name: 'Duplicate'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('uses SERVER_WEIGHTED extrapolation mode when alert has it configured', async () => {
    const {organization, routerProps} = initializeOrg();
    const ruleWithExtrapolation = MetricRuleFixture({
      projects: [project.slug],
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      aggregate: 'count()',
      query: '',
      eventTypes: [EventTypes.TRACE_ITEM_SPAN],
      extrapolationMode: ExtrapolationMode.SERVER_WEIGHTED,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/alert-rules/${ruleWithExtrapolation.id}/`,
      body: ruleWithExtrapolation,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/`,
      body: [],
    });

    const eventsStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture(),
    });

    render(
      <MetricAlertDetails
        organization={organization}
        {...routerProps}
        params={{ruleId: ruleWithExtrapolation.id}}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText(ruleWithExtrapolation.name)).toBeInTheDocument();

    // Verify events-stats is called with 'serverOnly' extrapolation mode
    expect(eventsStatsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          extrapolationMode: 'serverOnly',
          sampling: SAMPLING_MODE.NORMAL,
        }),
      })
    );
  });

  it('uses NONE extrapolation mode when alert has it configured', async () => {
    const {organization, routerProps} = initializeOrg();
    const ruleWithNoExtrapolation = MetricRuleFixture({
      projects: [project.slug],
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      aggregate: 'count()',
      query: '',
      eventTypes: [EventTypes.TRACE_ITEM_SPAN],
      extrapolationMode: ExtrapolationMode.NONE,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/alert-rules/${ruleWithNoExtrapolation.id}/`,
      body: ruleWithNoExtrapolation,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/incidents/`,
      body: [],
    });

    const eventsStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture(),
    });

    render(
      <MetricAlertDetails
        organization={organization}
        {...routerProps}
        params={{ruleId: ruleWithNoExtrapolation.id}}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText(ruleWithNoExtrapolation.name)).toBeInTheDocument();

    // Verify events-stats is called with 'none' extrapolation mode
    expect(eventsStatsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          extrapolationMode: 'none',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
        }),
      })
    );
  });
});
