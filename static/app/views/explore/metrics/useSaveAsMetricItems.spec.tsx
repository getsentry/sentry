import {QueryClientProvider} from '@tanstack/react-query';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {encodeMetricQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');
jest.mock('sentry/actionCreators/modal');

const mockedUseLocation = jest.mocked(useLocation);
const mockUseNavigate = jest.mocked(useNavigate);
const mockOpenSaveQueryModal = jest.mocked(modal.openSaveQueryModal);

describe('useSaveAsMetricItems', () => {
  const organization = OrganizationFixture({
    features: [
      'tracemetrics-enabled',
      'tracemetrics-alerts',
      'tracemetrics-equations-in-alerts',
    ],
  });
  const project = ProjectFixture({id: '1'});
  const queryClient = makeTestQueryClient();
  ProjectsStore.loadInitialData([project]);

  function createWrapper() {
    return function ({children}: {children?: React.ReactNode}) {
      return (
        <OrganizationContext.Provider value={organization}>
          <QueryClientProvider client={queryClient}>
            <MockMetricQueryParamsContext>{children}</MockMetricQueryParamsContext>
          </QueryClientProvider>
        </OrganizationContext.Provider>
      );
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
    queryClient.clear();

    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          interval: '5m',
        },
      })
    );
    mockUseNavigate.mockReturnValue(jest.fn());

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'Test Query'},
    });
  });

  it('should open save query modal when save as new query is clicked', () => {
    const {result} = renderHook(
      () =>
        useSaveAsMetricItems({
          interval: '5m',
        }),
      {wrapper: createWrapper()}
    );

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

    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          id: 'test-query-id',
          interval: '5m',
        },
      })
    );

    const {result} = renderHook(
      () =>
        useSaveAsMetricItems({
          interval: '5m',
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(result.current.some(item => item.key === 'update-query')).toBe(true);
    });

    const saveAsItems = result.current;
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('should show only new query option when no saved query exists', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          interval: '5m',
        },
      })
    );

    const {result} = renderHook(
      () =>
        useSaveAsMetricItems({
          interval: '5m',
        }),
      {wrapper: createWrapper()}
    );

    const saveAsItems = result.current;

    expect(saveAsItems.some(item => item.key === 'update-query')).toBe(false);
    expect(saveAsItems.some(item => item.key === 'save-query')).toBe(true);
  });

  it('formats add-to-dashboard submenu labels for multiple visualizes', () => {
    const yAxis1 = 'p50(value,metric.a,counter,-)';
    const yAxis2 = 'p75(value,metric.a,counter,-)';
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

    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          interval: '5m',
          metric: [encodedMetricQuery],
        },
      })
    );

    const {result} = renderHook(useSaveAsMetricItems, {
      wrapper: createWrapper(),
      initialProps: {interval: '5m'},
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

    mockedUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          interval: '5m',
          metric: [encodedMetricQuery],
        },
      })
    );

    const {result} = renderHook(useSaveAsMetricItems, {
      wrapper: createWrapper(),
      initialProps: {interval: '5m'},
    });

    const createAlertItems = result.current.find(item => item.key === 'create-alert') as
      | {children: Array<{label: string; to: string}>}
      | undefined;
    const createAlertItem = createAlertItems?.children?.find(item => item.label === 'ƒ1');

    expect(createAlertItem).toBeDefined();

    const url = new URL(createAlertItem?.to as string, 'http://example.com');
    const queryParams = new URLSearchParams(url.search);
    expect(queryParams.get('aggregate')).toBe(equation);
  });
});
