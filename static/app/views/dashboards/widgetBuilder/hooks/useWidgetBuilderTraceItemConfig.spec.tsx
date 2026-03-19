import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useWidgetBuilderTraceItemConfig} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderTraceItemConfig';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockedUseLocation = jest.mocked(useLocation);
const mockedUseNavigate = jest.mocked(useNavigate);

describe('useWidgetBuilderTraceItemConfig', () => {
  beforeEach(() => {
    mockedUseNavigate.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined query when multiple metrics are selected', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          dataset: WidgetType.TRACEMETRICS,
          displayType: 'line',
          yAxis: ['avg(value,metric_one,gauge,-)', 'sum(value,metric_two,counter,-)'],
        },
      })
    );

    const organization = OrganizationFixture({
      features: [
        'visibility-explore-view',
        'tracemetrics-multi-metric-selection-in-dashboards',
      ],
    });

    const {result} = renderHookWithProviders(() => useWidgetBuilderTraceItemConfig(), {
      organization,
      additionalWrapper: WidgetBuilderProvider,
    });

    expect(result.current.traceItemType).toBe(TraceItemDataset.TRACEMETRICS);
    expect(result.current.enabled).toBe(true);
    expect(result.current.query).toBeUndefined();
  });

  it('returns a query when a single metric is selected', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          dataset: WidgetType.TRACEMETRICS,
          displayType: 'line',
          yAxis: ['avg(value,metric_one,gauge,-)', 'max(value,metric_one,gauge,-)'],
        },
      })
    );

    const organization = OrganizationFixture({
      features: [
        'visibility-explore-view',
        'tracemetrics-multi-metric-selection-in-dashboards',
      ],
    });

    const {result} = renderHookWithProviders(() => useWidgetBuilderTraceItemConfig(), {
      organization,
      additionalWrapper: WidgetBuilderProvider,
    });

    expect(result.current.traceItemType).toBe(TraceItemDataset.TRACEMETRICS);
    expect(result.current.enabled).toBe(true);
    expect(result.current.query).toBeDefined();
    expect(result.current.query).toContain('metric_one');
  });
});
