import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {replaceUrlWithoutNavigation} from 'sentry/utils/url/replaceUrlWithoutNavigation';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {
  type EquationModeSnapshot,
  useTraceMetricsVisualizeModeState,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useTraceMetricsVisualizeModeState';
import {serializeFields} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

jest.mock('sentry/utils/url/replaceUrlWithoutNavigation');
const mockReplaceUrl = jest.mocked(replaceUrlWithoutNavigation);

const EQUATION_FEATURES = [
  'tracemetrics-enabled',
  'tracemetrics-equations-in-dashboards',
  'tracemetrics-equations-in-explore',
];

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

function makeQueryParams(yAxis: string, query = ''): ReadableQueryParams {
  return new ReadableQueryParams({
    extrapolate: true,
    mode: Mode.SAMPLES,
    query,
    cursor: '',
    fields: ['id', 'timestamp'],
    sortBys: [{field: 'timestamp', kind: 'desc'}],
    aggregateCursor: '',
    aggregateFields: [new VisualizeFunction(yAxis)],
    aggregateSortBys: [{field: yAxis, kind: 'desc'}],
  });
}

function makeEquationQueryParams(yAxis: string): ReadableQueryParams {
  return new ReadableQueryParams({
    extrapolate: true,
    mode: Mode.SAMPLES,
    query: '',
    cursor: '',
    fields: ['id', 'timestamp'],
    sortBys: [{field: 'timestamp', kind: 'desc'}],
    aggregateCursor: '',
    aggregateFields: [new VisualizeEquation(yAxis)],
    aggregateSortBys: [{field: yAxis, kind: 'desc'}],
  });
}

function makeEquationSnapshot(
  overrides?: Partial<EquationModeSnapshot>
): EquationModeSnapshot {
  return {
    queries: [
      {
        metric: {name: 'alpha_metric', type: 'counter'},
        queryParams: makeQueryParams(
          'sum(value,alpha_metric,counter,none)',
          'environment:prod'
        ),
        label: 'A',
      },
      {
        metric: {name: 'beta_metric', type: 'counter'},
        queryParams: makeQueryParams('avg(value,beta_metric,counter,none)'),
        label: 'B',
      },
      {
        metric: {name: '', type: ''},
        queryParams: makeEquationQueryParams(
          'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)'
        ),
        label: 'ƒ1',
      },
    ],
    selectedLabel: 'A',
    ...overrides,
  };
}

describe('useTraceMetricsVisualizeModeState', () => {
  beforeEach(() => {});

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('starts in series mode for non-equation yAxis', () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,none)'],
          },
        },
      },
    });

    expect(result.current.isEquationMode).toBe(false);
  });

  it('starts in equation mode when yAxis contains an equation', () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    expect(result.current.isEquationMode).toBe(true);
  });

  it('starts in series mode without the equations feature flag', () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: ['tracemetrics-enabled']}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    expect(result.current.isEquationMode).toBe(false);
  });

  it('toggles to equation mode', () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,none)'],
          },
        },
      },
    });

    act(() => {
      result.current.handleModeToggle(true);
    });

    expect(result.current.isEquationMode).toBe(true);
  });

  it('toggles to series mode', () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    act(() => {
      result.current.handleModeToggle(false);
    });

    expect(result.current.isEquationMode).toBe(false);
  });

  it('snapshots series state and restores it after a round-trip toggle', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,none)'],
            query: ['environment:prod'],
          },
        },
      },
    });

    act(() => {
      result.current.handleModeToggle(true);
    });

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(false);
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: ['sum', 'value', 'alpha_metric', 'counter', 'none'],
              },
            ]),
          }),
        })
      );
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: ['environment:prod'],
          }),
        })
      );
    });
  });

  it('clears legend aliases when switching to equation mode and restores them on return', async () => {
    function useCombinedStateHooks() {
      const modeState = useTraceMetricsVisualizeModeState();
      const {state} = useWidgetBuilderContext();
      return {visualizeModeState: modeState, widgetBuilderState: state};
    }

    const {result} = renderHookWithProviders(useCombinedStateHooks, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,none)'],
            legendAlias: ['my alias'],
          },
        },
      },
    });

    // Switch to equation mode — aliases should be cleared
    act(() => {
      result.current.visualizeModeState.handleModeToggle(true);
    });

    await waitFor(() => {
      expect(result.current.widgetBuilderState.legendAlias).toEqual([]);
    });

    // Switch back to series mode — aliases should be restored
    act(() => {
      result.current.visualizeModeState.handleModeToggle(false);
    });

    await waitFor(() => {
      expect(result.current.widgetBuilderState.legendAlias).toEqual(['my alias']);
    });
  });

  it('restores equation yAxis when toggling to equation mode with a cached snapshot', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,none)'],
          },
        },
      },
    });

    act(() => {
      result.current.equationSnapshot.current = makeEquationSnapshot({
        selectedLabel: 'B',
      });
    });

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(true);
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: ['avg', 'value', 'beta_metric', 'counter', 'none'],
              },
            ]),
          }),
        })
      );
    });
  });

  it('restores equation query from the selected row', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,none)'],
          },
        },
      },
    });

    act(() => {
      result.current.equationSnapshot.current = makeEquationSnapshot({
        selectedLabel: 'A',
      });
    });

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(true);
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: ['environment:prod'],
          }),
        })
      );
    });
  });

  it('falls back to first aggregate when selectedLabel does not match', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + avg(value,gamma_metric,counter,none)',
            ],
            label: 'test',
          },
        },
      },
    });

    act(() => {
      result.current.equationSnapshot.current = makeEquationSnapshot({
        selectedLabel: 'NONEXISTENT',
      });
    });

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(true);
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['sum(value,alpha_metric,counter,none)'],
          }),
        })
      );
    });
  });

  it('derives series fields from equation snapshot subcomponents when no series snapshot exists', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    expect(result.current.isEquationMode).toBe(true);

    act(() => {
      result.current.equationSnapshot.current = makeEquationSnapshot();
    });

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(false);
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: ['sum', 'value', 'alpha_metric', 'counter', 'none'],
              },
              {
                kind: FieldValueKind.FUNCTION,
                function: ['avg', 'value', 'beta_metric', 'counter', 'none'],
              },
            ]),
          }),
        })
      );
    });
  });

  it('pushes subcomponents even when the equation row is selected', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    act(() => {
      result.current.equationSnapshot.current = makeEquationSnapshot({
        selectedLabel: 'ƒ1',
      });
    });

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(false);
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: ['sum', 'value', 'alpha_metric', 'counter', 'none'],
              },
              {
                kind: FieldValueKind.FUNCTION,
                function: ['avg', 'value', 'beta_metric', 'counter', 'none'],
              },
            ]),
          }),
        })
      );
    });
  });

  it('falls back to default field when equation snapshot is empty', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: [
              'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)',
            ],
          },
        },
      },
    });

    expect(result.current.isEquationMode).toBe(true);

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(false);
    });

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: ['sum', 'value', undefined, undefined],
              },
            ]),
          }),
        })
      );
    });
  });

  it('seeds snapshot and dispatches equation yAxis when toggling to equation mode without a cached snapshot', async () => {
    const {result} = renderHookWithProviders(useTraceMetricsVisualizeModeState, {
      organization: OrganizationFixture({features: EQUATION_FEATURES}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(value,alpha_metric,counter,none)'],
          },
        },
      },
    });

    mockReplaceUrl.mockClear();
    act(() => {
      result.current.handleModeToggle(true);
    });

    expect(result.current.isEquationMode).toBe(true);
    expect(result.current.equationSnapshot.current).not.toBeNull();
    expect(result.current.equationSnapshot.current?.selectedLabel).toBe('ƒ1');

    await waitFor(() => {
      expect(mockReplaceUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['equation|'],
          }),
        })
      );
    });
  });
});
