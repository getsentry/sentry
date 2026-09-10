import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useWidgetBuilderTraceItemConfig} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderTraceItemConfig';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('useWidgetBuilderTraceItemConfig', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined query when multiple metrics are selected', () => {
    const organization = OrganizationFixture({
      features: [
        'visibility-explore-view',
        'tracemetrics-multi-metric-selection-in-dashboards',
      ],
    });

    const {result} = renderHookWithProviders(() => useWidgetBuilderTraceItemConfig(), {
      organization,
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: '/mock-pathname/',
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: 'line',
            yAxis: [
              'avg(value,metric_one,gauge,none)',
              'sum(value,metric_two,counter,none)',
            ],
          },
        },
      },
    });

    expect(result.current.traceItemType).toBe(TraceItemDataset.TRACEMETRICS);
    expect(result.current.enabled).toBe(true);
    expect(result.current.query).toBeUndefined();
  });

  it('returns a query when a single metric is selected', () => {
    const organization = OrganizationFixture({
      features: [
        'visibility-explore-view',
        'tracemetrics-multi-metric-selection-in-dashboards',
      ],
    });

    const {result} = renderHookWithProviders(() => useWidgetBuilderTraceItemConfig(), {
      organization,
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: '/mock-pathname/',
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: 'line',
            yAxis: [
              'avg(value,metric_one,gauge,none)',
              'max(value,metric_one,gauge,none)',
            ],
          },
        },
      },
    });

    expect(result.current.traceItemType).toBe(TraceItemDataset.TRACEMETRICS);
    expect(result.current.enabled).toBe(true);
    expect(result.current.query).toBeDefined();
    expect(result.current.query).toContain('metric_one');
  });
});
