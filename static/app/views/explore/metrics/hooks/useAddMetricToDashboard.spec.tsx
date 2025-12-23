import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useAddMetricToDashboard} from 'sentry/views/explore/metrics/hooks/useAddMetricToDashboard';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

jest.mock('sentry/actionCreators/modal');

describe('useAddMetricToDashboard', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();
  const context = initializeOrg({
    organization,
    projects: [project],
    router: {
      location: {
        pathname: '/organizations/org-slug/explore/metrics/',
        query: {project: project.id},
      },
      params: {},
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the dashboard modal with the trace metrics widget configuration', () => {
    const yAxis = 'avg(value,metric.a,counter,-)';
    const visualize = new VisualizeFunction(yAxis, {chartType: ChartType.BAR});
    const metricQuery: BaseMetricQuery = {
      metric: {name: 'metric.a', type: 'counter'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: 'release:1.2.3',
        cursor: '',
        fields: [],
        sortBys: [],
        aggregateCursor: '',
        aggregateFields: [visualize, {groupBy: 'project'}],
        aggregateSortBys: [{field: yAxis, kind: 'desc'}],
      }),
    };

    const {result} = renderHookWithProviders(useAddMetricToDashboard, {
      ...context,
    });

    act(() => {
      result.current.addToDashboard(metricQuery);
    });

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        widget: {
          title: 'Custom Widget',
          displayType: DisplayType.BAR,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.TRACEMETRICS,
          queries: [
            {
              aggregates: [yAxis],
              columns: ['project'],
              fields: ['project'],
              conditions: 'release:1.2.3',
              orderby: `-${yAxis}`,
              name: '',
            },
          ],
        },
      })
    );
  });

  it('does not pass an orderby if there are no group bys', () => {
    const yAxis = 'avg(value,metric.a,counter,-)';
    const visualize = new VisualizeFunction(yAxis, {chartType: ChartType.BAR});
    const metricQuery: BaseMetricQuery = {
      metric: {name: 'metric.a', type: 'counter'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: 'release:1.2.3',
        cursor: '',
        fields: [],
        sortBys: [],
        aggregateCursor: '',
        aggregateFields: [visualize],
        aggregateSortBys: [{field: yAxis, kind: 'desc'}],
      }),
    };

    const {result} = renderHookWithProviders(useAddMetricToDashboard, {
      ...context,
    });

    act(() => {
      result.current.addToDashboard(metricQuery);
    });

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        widget: {
          title: 'Custom Widget',
          displayType: DisplayType.BAR,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.TRACEMETRICS,
          queries: [
            {
              aggregates: [yAxis],
              columns: [],
              fields: [],
              conditions: 'release:1.2.3',
              orderby: '',
              name: '',
            },
          ],
        },
      })
    );
  });
});
