import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useWidgetBuilderTraceItemConfig} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderTraceItemConfig';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/utils/useNavigate');
jest.mock('sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext');

const mockedUseNavigate = jest.mocked(useNavigate);
const mockedUseWidgetBuilderContext = jest.mocked(useWidgetBuilderContext);

describe('useWidgetBuilderTraceItemConfig', () => {
  beforeEach(() => {
    mockedUseNavigate.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined query when multiple metrics are selected', () => {
    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis: [
          {
            kind: 'function',
            function: ['avg', 'value', 'metric_one', 'gauge', '-'],
          },
          {
            kind: 'function',
            function: ['sum', 'value', 'metric_two', 'counter', '-'],
          },
        ],
      },
      dispatch: jest.fn(),
    });

    const organization = OrganizationFixture({
      features: [
        'visibility-explore-view',
        'tracemetrics-multi-metric-selection-in-dashboards',
      ],
    });

    const {result} = renderHookWithProviders(() => useWidgetBuilderTraceItemConfig(), {
      organization,
    });

    expect(result.current.traceItemType).toBe(TraceItemDataset.TRACEMETRICS);
    expect(result.current.enabled).toBe(true);
    expect(result.current.query).toBeUndefined();
  });

  it('returns a query when a single metric is selected', () => {
    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis: [
          {
            kind: 'function',
            function: ['avg', 'value', 'metric_one', 'gauge', '-'],
          },
          {
            kind: 'function',
            function: ['max', 'value', 'metric_one', 'gauge', '-'],
          },
        ],
      },
      dispatch: jest.fn(),
    });

    const organization = OrganizationFixture({
      features: [
        'visibility-explore-view',
        'tracemetrics-multi-metric-selection-in-dashboards',
      ],
    });

    const {result} = renderHookWithProviders(() => useWidgetBuilderTraceItemConfig(), {
      organization,
    });

    expect(result.current.traceItemType).toBe(TraceItemDataset.TRACEMETRICS);
    expect(result.current.enabled).toBe(true);
    expect(result.current.query).toBeDefined();
    expect(result.current.query).toContain('metric_one');
  });
});
