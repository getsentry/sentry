import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {MetricsSection} from 'sentry/components/events/metrics/metricsSection';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

const TRACE_ID = '00000000000000000000000000000000';

const organization = OrganizationFixture({
  features: ['tracemetrics-enabled'],
});

const project = ProjectFixture();
const group = GroupFixture();

const event = EventFixture({
  id: '11111111111111111111111111111111',
  dateCreated: '2025-01-01T12:00:00.000Z',
  contexts: {
    trace: {
      trace_id: TRACE_ID,
      span_id: '1111111111111111',
      op: 'ui.action.click',
      type: 'trace',
    },
  },
});

describe('MetricsSection', () => {
  let metricId: string;
  let mockRequest: jest.Mock;

  beforeEach(() => {
    metricId = '22222222222222222222222222222222';

    ProjectsStore.loadInitialData([project]);

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/`,
      body: [project],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            [TraceMetricKnownFieldKey.ID]: metricId,
            [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
            [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
            [TraceMetricKnownFieldKey.TRACE]: TRACE_ID,
            [TraceMetricKnownFieldKey.METRIC_NAME]: 'http.server.duration',
            [TraceMetricKnownFieldKey.METRIC_TYPE]: 'distribution',
            [TraceMetricKnownFieldKey.METRIC_VALUE]: 150.5,
            [TraceMetricKnownFieldKey.TIMESTAMP]: '2025-01-01T12:00:00.000Z',
          },
        ],
        meta: {
          fields: {
            [TraceMetricKnownFieldKey.METRIC_NAME]: 'string',
            [TraceMetricKnownFieldKey.METRIC_TYPE]: 'string',
            [TraceMetricKnownFieldKey.METRIC_VALUE]: 'number',
          },
          units: {},
        },
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });

    // Mock telemetry requests for errors, spans, and logs
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({dataset: 'errors'})],
      body: {data: [], meta: {}},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({dataset: 'spansIndexed'})],
      body: {data: [], meta: {}},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({dataset: 'ourlogs'})],
      body: {data: [], meta: {}},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders empty when no trace id', () => {
    const eventWithoutTrace = EventFixture({
      contexts: {},
    });

    render(<MetricsSection event={eventWithoutTrace} project={project} group={group} />, {
      organization,
    });

    expect(screen.queryByText(/Metrics/)).not.toBeInTheDocument();
  });

  it('does not render when feature flag is disabled', () => {
    const orgWithoutFeature = OrganizationFixture({
      features: [],
    });

    render(<MetricsSection event={event} project={project} group={group} />, {
      organization: orgWithoutFeature,
    });

    expect(screen.queryByText(/Metrics/)).not.toBeInTheDocument();
  });

  it('renders empty when no metrics data', () => {
    const mockRequestEmpty = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
        meta: {},
      },
    });

    render(<MetricsSection event={event} project={project} group={group} />, {
      organization,
    });

    expect(mockRequestEmpty).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Metrics/)).not.toBeInTheDocument();
  });

  it('renders metrics section with data', async () => {
    render(<MetricsSection event={event} project={project} group={group} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {
            project: project.id,
          },
        },
      },
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Metrics/)).toBeInTheDocument();
    });

    expect(screen.getByTestId('metrics')).toBeInTheDocument();
  });

  it('shows view more button when there are more than 5 metrics', async () => {
    const mockRequestWithManyMetrics = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: Array.from({length: 10}, (_, i) => ({
          [TraceMetricKnownFieldKey.ID]: `metric-${i}`,
          [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
          [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
          [TraceMetricKnownFieldKey.TRACE]: TRACE_ID,
          [TraceMetricKnownFieldKey.METRIC_NAME]: `metric.name.${i}`,
          [TraceMetricKnownFieldKey.METRIC_TYPE]: 'counter',
          [TraceMetricKnownFieldKey.METRIC_VALUE]: i * 10,
          [TraceMetricKnownFieldKey.TIMESTAMP]: '2025-01-01T12:00:00.000Z',
        })),
        meta: {
          fields: {
            [TraceMetricKnownFieldKey.METRIC_NAME]: 'string',
            [TraceMetricKnownFieldKey.METRIC_TYPE]: 'string',
            [TraceMetricKnownFieldKey.METRIC_VALUE]: 'number',
          },
          units: {},
        },
      },
    });

    render(<MetricsSection event={event} project={project} group={group} />, {
      organization,
    });

    expect(mockRequestWithManyMetrics).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Metrics/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', {name: 'View more'})).toBeInTheDocument();
  });

  it('opens metrics drawer when view more is clicked', async () => {
    const mockRequestWithManyMetrics = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: Array.from({length: 10}, (_, i) => ({
          [TraceMetricKnownFieldKey.ID]: `metric-${i}`,
          [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
          [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
          [TraceMetricKnownFieldKey.TRACE]: TRACE_ID,
          [TraceMetricKnownFieldKey.METRIC_NAME]: `metric.name.${i}`,
          [TraceMetricKnownFieldKey.METRIC_TYPE]: 'counter',
          [TraceMetricKnownFieldKey.METRIC_VALUE]: i * 10,
          [TraceMetricKnownFieldKey.TIMESTAMP]: '2025-01-01T12:00:00.000Z',
        })),
        meta: {
          fields: {
            [TraceMetricKnownFieldKey.METRIC_NAME]: 'string',
            [TraceMetricKnownFieldKey.METRIC_TYPE]: 'string',
            [TraceMetricKnownFieldKey.METRIC_VALUE]: 'number',
          },
          units: {},
        },
      },
    });

    render(<MetricsSection event={event} project={project} group={group} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {
            project: project.id,
          },
        },
      },
    });

    expect(mockRequestWithManyMetrics).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Metrics/)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('complementary', {name: 'metrics drawer'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'View more'}));

    const aside = screen.getByRole('complementary', {name: 'metrics drawer'});
    expect(aside).toBeInTheDocument();

    // Check that the drawer contains the expected elements
    expect(within(aside).getByText('Metrics')).toBeInTheDocument();
    expect(
      within(aside).getByPlaceholderText('Search metrics for this trace')
    ).toBeInTheDocument();
  });

  it('does not show view more button when there are 5 or fewer metrics', async () => {
    const mockRequestWithFewMetrics = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: Array.from({length: 3}, (_, i) => ({
          [TraceMetricKnownFieldKey.ID]: `metric-${i}`,
          [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
          [TraceMetricKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
          [TraceMetricKnownFieldKey.TRACE]: TRACE_ID,
          [TraceMetricKnownFieldKey.METRIC_NAME]: `metric.name.${i}`,
          [TraceMetricKnownFieldKey.METRIC_TYPE]: 'counter',
          [TraceMetricKnownFieldKey.METRIC_VALUE]: i * 10,
          [TraceMetricKnownFieldKey.TIMESTAMP]: '2025-01-01T12:00:00.000Z',
        })),
        meta: {
          fields: {
            [TraceMetricKnownFieldKey.METRIC_NAME]: 'string',
            [TraceMetricKnownFieldKey.METRIC_TYPE]: 'string',
            [TraceMetricKnownFieldKey.METRIC_VALUE]: 'number',
          },
          units: {},
        },
      },
    });

    render(<MetricsSection event={event} project={project} group={group} />, {
      organization,
    });

    expect(mockRequestWithFewMetrics).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Metrics/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', {name: 'View more'})).not.toBeInTheDocument();
  });
});
