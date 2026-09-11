import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import * as discoverUtils from 'sentry/views/discover/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {encodeMetricQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

jest.mock('sentry/actionCreators/modal');
jest.mock('sentry/views/discover/utils');

const mockOpenSaveQueryModal = jest.mocked(modal.openSaveQueryModal);
const mockHandleAddQueryToDashboard = jest.mocked(
  discoverUtils.handleAddQueryToDashboard
);
const mockHandleAddMultipleQueriesToDashboard = jest.mocked(
  discoverUtils.handleAddMultipleQueriesToDashboard
);
const initialRouterConfig = {
  location: {
    pathname: '/organizations/org-slug/explore/metrics/',
    query: {interval: '5m'},
  },
};

describe('useSaveAsMetricItems', () => {
  const organization = OrganizationFixture({
    features: ['tracemetrics-enabled'],
  });
  const project = ProjectFixture({id: '1'});

  function Wrapper({children}: {children: ReactNode}) {
    return <MockMetricQueryParamsContext>{children}</MockMetricQueryParamsContext>;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'Test Query'},
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('should open save query modal when save as new query is clicked', () => {
    const {result} = renderHookWithProviders(useSaveAsMetricItems, {
      organization,
      additionalWrapper: Wrapper,
      initialProps: {interval: '5m'},
      initialRouterConfig,
    });

    const saveAsItems = result.current;
    const saveAsQuery = saveAsItems.find(item => item.key === 'save-query') as {
      onAction: () => void;
    };

    saveAsQuery?.onAction?.();

    expect(mockOpenSaveQueryModal).toHaveBeenCalledWith({
      organization,
      saveQuery: expect.any(Function),
      source: 'table',
      traceItemDataset: 'tracemetrics',
    });
  });

  it('should show both existing and new query options when saved query exists', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/test-query-id/`,
      body: {
        id: 'test-query-id',
        name: 'Test Metrics Query',
        isPrebuilt: false,
        query: [{}],
        dateAdded: '2024-01-01T00:00:00.000Z',
        dateUpdated: '2024-01-01T00:00:00.000Z',
        interval: '5m',
        lastVisited: '2024-01-01T00:00:00.000Z',
        position: null,
        projects: [1],
        dataset: 'tracemetrics',
        starred: false,
      },
    });

    const {result} = renderHookWithProviders(useSaveAsMetricItems, {
      organization,
      additionalWrapper: Wrapper,
      initialProps: {interval: '5m'},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            ...initialRouterConfig.location.query,
            id: 'test-query-id',
          },
        },
      },
    });

    await waitFor(() => {
      expect(result.current.some(item => item.key === 'update-query')).toBe(true);
    });

    const saveAsItems = result.current;
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('should show only new query option when no saved query exists', () => {
    const {result} = renderHookWithProviders(useSaveAsMetricItems, {
      organization,
      additionalWrapper: Wrapper,
      initialProps: {interval: '5m'},
      initialRouterConfig,
    });

    const saveAsItems = result.current;

    expect(saveAsItems.some(item => item.key === 'update-query')).toBe(false);
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('formats add-to-dashboard submenu labels for multiple visualizes', () => {
    const yAxis1 = 'p50(value,metric.a,counter,none)';
    const yAxis2 = 'p75(value,metric.a,counter,none)';
    const encodedMetricQuery = encodeMetricQueryParams({
      metric: {name: 'metric.a', type: 'counter'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: 'release:1.2.3',
        cursor: '',
        fields: [],
        sortBys: [],
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction(yAxis1), new VisualizeFunction(yAxis2)],
        aggregateSortBys: [{field: yAxis1, kind: 'desc'}],
      }),
    });

    const {result} = renderHookWithProviders(useSaveAsMetricItems, {
      organization,
      additionalWrapper: Wrapper,
      initialProps: {interval: '5m'},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            ...initialRouterConfig.location.query,
            metric: [encodedMetricQuery],
          },
        },
      },
    });

    const addToDashboardItem = result.current.find(
      item => item.key === 'add-to-dashboard'
    ) as {children?: Array<{key: string; label: string}>} | undefined;

    expect(addToDashboardItem).toBeDefined();
    expect(addToDashboardItem?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'add-to-dashboard-0',
          label: 'A: p50, p75(metric.a)',
        }),
      ])
    );
  });

  it('enables equations in add-to-dashboard', () => {
    const function1 = new VisualizeFunction('sum(value,metric.a,counter,none)');
    const function2 = new VisualizeFunction('avg(value,metric.a,counter,none)');
    const equation = `equation|${function1.yAxis} + ${function2.yAxis}`;
    const equationObj = new VisualizeEquation(equation);

    const metricFunctions = [function1, function2, equationObj];
    const encodedMetricQueries = metricFunctions.map(fn =>
      encodeMetricQueryParams({
        metric: {name: 'metric.a', type: 'counter'},
        queryParams: new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.AGGREGATE,
          query: 'release:1.2.3',
          aggregateCursor: '',
          aggregateFields: [fn],
          aggregateSortBys: [{field: fn.yAxis, kind: 'desc'}],
          cursor: '',
          fields: [],
          sortBys: [],
        }),
      })
    );

    const {result} = renderHookWithProviders(useSaveAsMetricItems, {
      organization,
      additionalWrapper: Wrapper,
      initialProps: {interval: '5m'},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            ...initialRouterConfig.location.query,
            metric: encodedMetricQueries,
          },
        },
      },
    });

    const addToDashboardItem = result.current.find(
      item => item.key === 'add-to-dashboard'
    ) as
      | {
          children?: Array<{
            key: string;
            label: string;
            onAction: () => void;
          }>;
        }
      | undefined;

    const equationChild = addToDashboardItem?.children?.find(
      item => item.key === 'add-to-dashboard-2'
    );

    expect(equationChild?.label).toBe('ƒ1');

    equationChild?.onAction?.();

    expect(mockHandleAddQueryToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        eventView: expect.objectContaining({
          yAxis: equation,
        }),
        yAxis: equation,
      })
    );

    mockHandleAddQueryToDashboard.mockClear();
    mockHandleAddMultipleQueriesToDashboard.mockClear();

    const addAllToDashboard = addToDashboardItem?.children?.find(
      item => item.key === 'add-to-dashboard-all'
    );

    addAllToDashboard?.onAction?.();

    expect(mockHandleAddMultipleQueriesToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        eventViews: expect.arrayContaining([
          expect.objectContaining({
            yAxis: equation,
          }),
        ]),
      })
    );
  });

  it('enables the alert option when there are aggregates', () => {
    const encodedMetricQuery = encodeMetricQueryParams({
      metric: {name: 'metric.a', type: 'counter'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: 'release:1.2.3',
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction('sum(value,metric.a,counter,none)')],
        aggregateSortBys: [{field: 'sum(value,metric.a,counter,none)', kind: 'desc'}],
        cursor: '',
        fields: [],
        sortBys: [],
      }),
    });

    const {result} = renderHookWithProviders(useSaveAsMetricItems, {
      organization,
      additionalWrapper: Wrapper,
      initialProps: {interval: '5m'},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            ...initialRouterConfig.location.query,
            metric: [encodedMetricQuery],
          },
        },
      },
    });

    const alertItem = result.current.find(item => item.key === 'create-alert') as
      | {children: unknown[]; disabled: boolean}
      | undefined;

    expect(alertItem?.disabled).toBe(false);
    expect(alertItem?.children).toHaveLength(1);
  });

  it('formats alerts submenu labels for equations', () => {
    const equation =
      'equation|sum(value,metric.a,counter,none) + avg(value,metric.a,counter,none)';
    const encodedMetricQuery = encodeMetricQueryParams({
      metric: {name: 'metric.a', type: 'counter'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: 'release:1.2.3',
        aggregateCursor: '',
        aggregateFields: [new VisualizeEquation(equation)],
        aggregateSortBys: [{field: equation, kind: 'desc'}],
        cursor: '',
        fields: [],
        sortBys: [],
      }),
      label: 'ƒ1',
    });

    const {result} = renderHookWithProviders(useSaveAsMetricItems, {
      organization,
      additionalWrapper: Wrapper,
      initialProps: {interval: '5m'},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            ...initialRouterConfig.location.query,
            metric: [encodedMetricQuery],
          },
        },
      },
    });

    const createAlertItems = result.current.find(item => item.key === 'create-alert') as
      | {children: Array<{label: string; to: string}>}
      | undefined;
    const createAlertItem = createAlertItems?.children?.find(item => item.label === 'ƒ1');

    expect(createAlertItem).toBeDefined();

    const url = new URL(createAlertItem?.to!, 'http://example.com');
    const queryParams = new URLSearchParams(url.search);
    expect(queryParams.get('aggregate')).toBe(equation);
  });
});
