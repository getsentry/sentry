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

jest.mock('sentry/utils/useNavigate');
const mockedUseNavigate = jest.mocked(useNavigate);

const EQUATION_FEATURES = [
  'tracemetrics-enabled',
  'tracemetrics-equations-in-dashboards',
  'tracemetrics-equations-in-explore',
];

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
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('selects a row and syncs yAxis to widget builder', async () => {
    render(<MetricsEquationVisualize onEquationRemoved={jest.fn()} />, {
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

  it('calls onEquationRemoved when the equation row is deleted', async () => {
    const onEquationRemoved = jest.fn();

    render(<MetricsEquationVisualize onEquationRemoved={onEquationRemoved} />, {
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

    // The equation row's delete button is the last one
    const deleteButtons = screen.getAllByRole('button', {name: 'Delete Metric'});
    const equationDeleteButton = deleteButtons[deleteButtons.length - 1]!;

    await userEvent.click(equationDeleteButton);

    await waitFor(() => {
      expect(onEquationRemoved).toHaveBeenCalled();
    });

    // Should fall back to the first function row's yAxis
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: ['sum', 'value', 'alpha_metric', 'counter', 'none'],
              },
            ]),
          }),
        }),
        expect.anything()
      );
    });
  });

  it('hydrates initial rows from a saved equation widget', async () => {
    render(<MetricsEquationVisualize onEquationRemoved={jest.fn()} />, {
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
