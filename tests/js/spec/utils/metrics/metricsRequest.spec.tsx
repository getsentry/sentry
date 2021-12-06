import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import MetricsRequest from 'sentry/utils/metrics/metricsRequest';

describe('MetricsRequest', () => {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
  const childrenMock = jest.fn(() => null);
  const props = {
    api: new MockApiClient(),
    organization,
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
      loading: true,
      reloading: false,
      response: null,
      responsePrevious: null,
    });

    expect(metricsMock).toHaveBeenCalledTimes(1);
    expect(metricsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          end: undefined,
          environment: ['prod'],
          field: ['fieldA'],
          groupBy: ['status'],
          interval: '1h',
          limit: 3,
          orderBy: 'fieldA',
          project: ['2'],
          query: 'abc',
          start: undefined,
          statsPeriod: '14d',
        },
      })
    );

    await waitFor(() =>
      expect(childrenMock).toHaveBeenLastCalledWith({
        errored: false,
        loading: false,
        reloading: false,
        response: {groups: [], intervals: []},
        responsePrevious: null,
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
      loading: false,
      reloading: false,
      response: null,
      responsePrevious: null,
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
      loading: true,
      reloading: false,
      response: null,
      responsePrevious: null,
    });

    expect(metricsMock).toHaveBeenCalledTimes(2);

    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: {
          end: undefined,
          environment: ['prod'],
          field: ['fieldA'],
          groupBy: ['status'],
          interval: '1h',
          limit: 3,
          orderBy: 'fieldA',
          project: ['2'],
          query: 'abc',
          start: undefined,
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
          limit: 3,
          interval: '1h',
          statsPeriodStart: '28d',
          statsPeriodEnd: '14d',
        },
      })
    );

    await waitFor(() =>
      expect(childrenMock).toHaveBeenLastCalledWith({
        errored: false,
        loading: false,
        reloading: false,
        response: {groups: [], intervals: []},
        responsePrevious: {groups: [], intervals: []},
      })
    );
  });
});
