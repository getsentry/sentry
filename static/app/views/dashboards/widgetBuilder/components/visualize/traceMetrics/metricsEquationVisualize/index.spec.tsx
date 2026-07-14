import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {MetricsEquationVisualize} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {serializeFields} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {
  defaultMetricQuery,
  type BaseMetricQuery,
} from 'sentry/views/explore/metrics/metricQuery';

jest.mock('sentry/utils/useNavigate');

let parseOverride: any = null;
jest.mock('sentry/views/explore/metrics/parseAggregateExpression', () => {
  const actual = jest.requireActual(
    'sentry/views/explore/metrics/parseAggregateExpression'
  );
  return {
    ...actual,
    parseAggregateExpression: (...args: any[]) =>
      parseOverride ?? actual.parseAggregateExpression(...args),
  };
});

// Override useStableLabels so preset query.label values are honoured on init for test setup
jest.mock('sentry/views/explore/metrics/hooks/useStableLabels', () => {
  const actual = jest.requireActual('sentry/views/explore/metrics/hooks/useStableLabels');
  return {
    ...actual,
    useStableLabels: (queries: BaseMetricQuery[]) => {
      const result = actual.useStableLabels(queries);
      const hasPreset = queries.every((q: BaseMetricQuery) => q.label);
      if (hasPreset) {
        return {
          ...result,
          getLabel: (i: number) => queries[i]?.label ?? result.getLabel(i),
        };
      }
      return result;
    },
  };
});

const mockedUseNavigate = jest.mocked(useNavigate);

const EQUATION_FEATURES = ['tracemetrics-enabled', 'tracemetrics-equations-in-explore'];

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

function setupMockApis() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    method: 'GET',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [
        {
          ['metric.name']: 'alpha_metric',
          ['metric.type']: 'counter',
          ['count(metric.name)']: 1,
        },
        {
          ['metric.name']: 'beta_metric',
          ['metric.type']: 'counter',
          ['count(metric.name)']: 1,
        },
      ],
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/recent-searches/',
    body: [],
  });
}

describe('MetricsEquationVisualize', () => {
  let mockNavigate!: jest.Mock;

  beforeEach(() => {
    mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);
    setupMockApis();
  });

  afterEach(() => {
    parseOverride = null;
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('selects a row and syncs yAxis to widget builder', async () => {
    render(<MetricsEquationVisualize />, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + sum(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    const toolbars = await screen.findAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(3);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons).toHaveLength(3);

    // Click the second row's radio button (row B)
    await userEvent.click(radioButtons[1]!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: ['sum', 'value', 'beta_metric', 'counter', 'none'],
              },
            ]),
          }),
        }),
        expect.anything()
      );
    });
  });

  it('disables deleting the equation row', async () => {
    render(<MetricsEquationVisualize />, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + sum(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    const toolbars = await screen.findAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(3);

    const deleteButtons = screen.getAllByRole('button', {name: 'Delete Metric'});
    const equationDeleteButton = deleteButtons[deleteButtons.length - 1]!;

    expect(equationDeleteButton).toBeDisabled();
  });

  it('replaces rate aggregates with defaults and deduplicates', async () => {
    render(<MetricsEquationVisualize />, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'per_second(value,alpha_metric,counter,none)',
              'per_minute(value,alpha_metric,counter,none)',
              'per_second(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    const toolbars = await screen.findAllByTestId('metric-toolbar');
    // per_second and per_minute on alpha_metric both collapse to sum → deduplicated to 1 row
    // per_second on beta_metric collapses to sum → 1 row
    // + equation row = 3 total
    expect(toolbars).toHaveLength(3);

    // Row A: alpha_metric with default aggregate (sum for counter)
    expect(within(toolbars[0]!).getByText('A')).toBeInTheDocument();
    expect(
      within(toolbars[0]!).getByRole('button', {name: 'alpha_metric'})
    ).toBeInTheDocument();
    expect(within(toolbars[0]!).getByText('sum')).toBeInTheDocument();

    // Row B: beta_metric with default aggregate (sum for counter)
    expect(within(toolbars[1]!).getByText('B')).toBeInTheDocument();
    expect(
      within(toolbars[1]!).getByRole('button', {name: 'beta_metric'})
    ).toBeInTheDocument();
    expect(within(toolbars[1]!).getByText('sum')).toBeInTheDocument();
  });

  it('limits adding metrics past label Z and re-enables after deleting Z', async () => {
    parseOverride = {
      metricQueries: [
        {...defaultMetricQuery(), label: 'A'},
        {...defaultMetricQuery(), label: 'Y'},
      ],
      equationRow: {...defaultMetricQuery({type: 'equation'}), label: 'ƒ1'},
      compactExpression: 'A + Y',
    };

    render(<MetricsEquationVisualize />, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['equation|A + Y'],
          },
        },
      },
    });

    // 2 metric rows (A, Y) + 1 equation row (ƒ1)
    const toolbars = await screen.findAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(3);
    expect(within(toolbars[0]!).getByText('A')).toBeInTheDocument();
    expect(within(toolbars[1]!).getByText('Y')).toBeInTheDocument();

    // Should be able to add Z
    const addButton = screen.getByRole('button', {name: 'Add Metric'});
    expect(addButton).toBeEnabled();
    await userEvent.click(addButton);

    // Z is inserted before the equation row
    await waitFor(() => {
      expect(screen.getAllByTestId('metric-toolbar')).toHaveLength(4);
    });
    expect(
      within(screen.getAllByTestId('metric-toolbar')[2]!).getByText('Z')
    ).toBeInTheDocument();

    // Cannot add past Z
    expect(screen.getByRole('button', {name: 'Add Metric'})).toBeDisabled();

    // Deleting Z re-enables adding
    const deleteButtons = screen.getAllByRole('button', {name: 'Delete Metric'});
    await userEvent.click(deleteButtons[2]!);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Add Metric'})).toBeEnabled();
    });
  });

  it('hydrates initial rows from a saved equation widget', async () => {
    render(<MetricsEquationVisualize />, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum_if(`environment:prod`,value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
            ],
            query: 'environment:[prod,dev]',
          },
        },
      },
    });

    const toolbars = await screen.findAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(3);

    // Row A: alpha_metric with sum aggregate and environment:prod filter
    expect(within(toolbars[0]!).getByText('A')).toBeInTheDocument();
    expect(
      within(toolbars[0]!).getByRole('button', {name: 'alpha_metric'})
    ).toBeInTheDocument();
    expect(within(toolbars[0]!).getByText('sum')).toBeInTheDocument();
    expect(
      within(toolbars[0]!).getByRole('row', {name: 'environment:prod'})
    ).toBeInTheDocument();

    // Row B: beta_metric with avg aggregate
    expect(within(toolbars[1]!).getByText('B')).toBeInTheDocument();
    expect(
      within(toolbars[1]!).getByRole('button', {name: 'beta_metric'})
    ).toBeInTheDocument();
    expect(within(toolbars[1]!).getByText('avg')).toBeInTheDocument();

    // Row ƒ1: equation row with its own environment filter
    expect(within(toolbars[2]!).getByText('ƒ1')).toBeInTheDocument();
    expect(
      within(toolbars[2]!).getByRole('row', {name: 'environment:[prod,dev]'})
    ).toBeInTheDocument();
  });
});
