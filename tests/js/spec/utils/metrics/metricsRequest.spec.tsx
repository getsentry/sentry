import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {transformMetricsResponseToSeries} from 'sentry/utils/metrics/transformMetricsResponseToSeries';

jest.mock('sentry/utils/metrics/transformMetricsResponseToSeries', () => ({
  transformMetricsResponseToSeries: jest.fn().mockReturnValue([]),
}));

describe('MetricsRequest', () => {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
  const childrenMock = jest.fn(() => null);
  const props = {
    api: new MockApiClient(),
    orgSlug: organization.slug,
    field: ['fieldA'],
    project: [project.id],
    environment: ['prod'],
    statsPeriod: '14d',
    query: 'abc',
    groupBy: ['status'],
    orderBy: 'fieldA',
    limit: 3,
  };
  let metricsMock;

  beforeEach(() => {
    metricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: {intervals: [], groups: []},
    });
    childrenMock.mockClear();
  });

  it('makes request and passes correct render props', async () => {
    mountWithTheme(<MetricsRequest {...props}>{childrenMock}</MetricsRequest>);

    expect(childrenMock).toHaveBeenNthCalledWith(1, {
      errored: false,
      error: null,
      loading: true,
      isLoading: true,
      reloading: false,
      response: null,
      responsePrevious: null,
      tableData: undefined,
      pageLinks: null,
    });

    expect(metricsMock).toHaveBeenCalledTimes(1);
    expect(metricsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['fieldA'],
          groupBy: ['status'],
          interval: '1h',
          per_page: 3,
          orderBy: 'fieldA',
          project: ['2'],
          query: 'abc',
          statsPeriod: '14d',
        },
      })
    );

    await waitFor(() =>
      expect(childrenMock).toHaveBeenLastCalledWith({
        errored: false,
        error: null,
        loading: false,
        isLoading: false,
        reloading: false,
        response: {groups: [], intervals: []},
        responsePrevious: null,
        tableData: undefined,
        pageLinks: null,
      })
    );
  });

  it('does not make request if isDisabled', () => {
    mountWithTheme(
      <MetricsRequest {...props} isDisabled>
        {childrenMock}
      </MetricsRequest>
    );

    expect(metricsMock).toHaveBeenCalledTimes(0);

    expect(childrenMock).toHaveBeenCalledTimes(1);
    expect(childrenMock).toHaveBeenCalledWith({
      errored: false,
      error: null,
      loading: false,
      isLoading: false,
      reloading: false,
      response: null,
      responsePrevious: null,
      tableData: undefined,
      pageLinks: null,
    });
  });

  it('refetches when props change', () => {
    const {rerender} = mountWithTheme(
      <MetricsRequest {...props}>{childrenMock}</MetricsRequest>
    );

    expect(metricsMock).toHaveBeenCalledTimes(1);

    rerender(
      <MetricsRequest {...props} field={['fieldB']}>
        {childrenMock}
      </MetricsRequest>
    );

    expect(metricsMock).toHaveBeenCalledTimes(2);
    expect(metricsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({field: ['fieldB']}),
      })
    );
  });

  it('does not refetch when ignored props change', () => {
    const {rerender} = mountWithTheme(
      <MetricsRequest {...props}>{childrenMock}</MetricsRequest>
    );

    const differentChildrenMock = jest.fn(() => 'lorem ipsum');
    rerender(<MetricsRequest {...props}>{differentChildrenMock}</MetricsRequest>);

    expect(metricsMock).toHaveBeenCalledTimes(1);
  });

  it('make two requests if includePrevious is enabled', async () => {
    mountWithTheme(
      <MetricsRequest {...props} includePrevious>
        {childrenMock}
      </MetricsRequest>
    );

    expect(childrenMock).toHaveBeenNthCalledWith(1, {
      errored: false,
      error: null,
      loading: true,
      isLoading: true,
      reloading: false,
      response: null,
      responsePrevious: null,
      tableData: undefined,
      pageLinks: null,
    });

    expect(metricsMock).toHaveBeenCalledTimes(2);

    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['fieldA'],
          groupBy: ['status'],
          interval: '1h',
          per_page: 3,
          orderBy: 'fieldA',
          project: ['2'],
          query: 'abc',
          statsPeriod: '14d',
        },
      })
    );

    expect(metricsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          project: ['2'],
          environment: ['prod'],
          field: ['fieldA'],
          query: 'abc',
          groupBy: ['status'],
          orderBy: 'fieldA',
          per_page: 3,
          interval: '1h',
          statsPeriodStart: '28d',
          statsPeriodEnd: '14d',
        },
      })
    );

    await waitFor(() =>
      expect(childrenMock).toHaveBeenLastCalledWith({
        errored: false,
        error: null,
        loading: false,
        isLoading: false,
        reloading: false,
        response: {groups: [], intervals: []},
        responsePrevious: {groups: [], intervals: []},
        tableData: undefined,
        pageLinks: null,
      })
    );
  });

  it('make one request with absolute date', () => {
    mountWithTheme(
      <MetricsRequest
        {...props}
        statsPeriod=""
        start="Wed Dec 01 2021 01:00:00 GMT+0100 (Central European Standard Time)"
        end="Fri Dec 17 2021 00:59:59 GMT+0100 (Central European Standard Time)"
        includePrevious
      >
        {childrenMock}
      </MetricsRequest>
    );

    expect(childrenMock).toHaveBeenNthCalledWith(1, {
      errored: false,
      error: null,
      loading: true,
      isLoading: true,
      reloading: false,
      response: null,
      responsePrevious: null,
      tableData: undefined,
      pageLinks: null,
    });

    // if start and end are provided, it will not perform a request to fetch previous data
    expect(metricsMock).toHaveBeenCalledTimes(1);

    expect(metricsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          end: '2021-12-17T00:59:59.000',
          environment: ['prod'],
          field: ['fieldA'],
          groupBy: ['status'],
          interval: '1h',
          per_page: 3,
          orderBy: 'fieldA',
          project: ['2'],
          query: 'abc',
          start: '2021-12-01T01:00:00.000',
        },
      })
    );
  });

  it('includes series data', () => {
    mountWithTheme(
      <MetricsRequest {...props} includeSeriesData includePrevious>
        {childrenMock}
      </MetricsRequest>
    );

    expect(metricsMock).toHaveBeenCalledTimes(2);

    expect(childrenMock).toHaveBeenLastCalledWith({
      error: null,
      errored: false,
      isLoading: true,
      loading: true,
      pageLinks: null,
      reloading: false,
      response: null,
      responsePrevious: null,
      seriesData: [],
      seriesDataPrevious: [],
      tableData: undefined,
    });

    expect(transformMetricsResponseToSeries).toHaveBeenCalledWith(null);
  });
});
