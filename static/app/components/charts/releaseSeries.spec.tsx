import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useReleaseSeries} from 'sentry/components/charts/releaseSeries';

type Props = Parameters<typeof useReleaseSeries>[0];

describe('useReleaseSeries', () => {
  const organization = OrganizationFixture();
  let releases: any;
  let releasesMock: any;

  beforeEach(() => {
    releases = [
      {
        version: 'sentry-android-shop@1.2.0',
        date: '2020-03-23T00:00:00Z',
      },
    ];
    MockApiClient.clearMockResponses();
    releasesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: releases,
    });
  });

  const baseProps: Props = {
    period: '14d',
    start: null,
    end: null,
    utc: false,
    projects: [],
    query: '',
    environments: [],
  };

  it('does not fetch releases if releases is truthy', () => {
    renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, releases: []},
      organization,
    });

    expect(releasesMock).not.toHaveBeenCalled();
  });

  it('does not fetch releases if not enabled', () => {
    const {result} = renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, enabled: false},
      organization,
    });

    expect(releasesMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({releases: [], releaseSeries: []});
  });

  it('fetches releases if becomes enabled', async () => {
    const {rerender} = renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, enabled: false},
      organization,
    });

    expect(releasesMock).not.toHaveBeenCalled();

    rerender({...baseProps, enabled: true});
    await act(tick);

    expect(releasesMock).toHaveBeenCalledTimes(1);

    rerender({...baseProps, enabled: false});
    await act(tick);

    expect(releasesMock).toHaveBeenCalledTimes(1);
  });

  it('fetches releases if no releases passed through props', async () => {
    const {result} = renderHookWithProviders(useReleaseSeries, {
      initialProps: baseProps,
      organization,
    });

    expect(releasesMock).toHaveBeenCalled();
    await waitFor(() => expect(result.current.releases).toEqual(releases));
  });

  it('fetches releases with project conditions', async () => {
    renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, projects: [1, 2]},
      organization,
    });

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({project: [1, 2]}),
        })
      )
    );
  });

  it('fetches releases with environment conditions', async () => {
    renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, environments: ['dev', 'test']},
      organization,
    });

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({environment: ['dev', 'test']}),
        })
      )
    );
  });

  it('fetches releases with start and end date strings', async () => {
    renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, start: '2020-01-01', end: '2020-01-31'},
      organization,
    });

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2020-01-01T00:00:00',
            end: '2020-01-31T00:00:00',
          }),
        })
      )
    );
  });

  it('fetches releases with start and end dates', async () => {
    const start = new Date(Date.UTC(2020, 0, 1, 12, 13, 14));
    const end = new Date(Date.UTC(2020, 0, 31, 14, 15, 16));
    renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, start, end},
      organization,
    });

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2020-01-01T12:13:14',
            end: '2020-01-31T14:15:16',
          }),
        })
      )
    );
  });

  it('fetches releases with period', async () => {
    renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, period: '14d'},
      organization,
    });

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({statsPeriod: '14d'}),
        })
      )
    );
  });

  it('fetches on property updates', async () => {
    const {rerender} = renderHookWithProviders(useReleaseSeries, {
      initialProps: baseProps,
      organization,
    });

    const cases: Array<Partial<Props>> = [
      {period: '7d'},
      {start: '2020-01-01', end: '2020-01-02'},
      {projects: [1]},
    ];
    for (const scenario of cases) {
      releasesMock.mockReset();

      rerender({...baseProps, ...scenario});

      expect(releasesMock).toHaveBeenCalled();
    }

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(1));
  });

  it('does not refetch when rebuilt dates and arrays are equal', async () => {
    const {rerender} = renderHookWithProviders(useReleaseSeries, {
      initialProps: {
        ...baseProps,
        start: new Date(Date.UTC(2020, 0, 1)),
        end: new Date(Date.UTC(2020, 0, 2)),
        projects: [1],
      },
      organization,
    });

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(1));

    rerender({
      ...baseProps,
      start: new Date(Date.UTC(2020, 0, 1)),
      end: new Date(Date.UTC(2020, 0, 2)),
      projects: [1],
    });
    await act(tick);

    expect(releasesMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch releases with memoize enabled', async () => {
    const {rerender} = renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, period: '14d', memoized: true},
      organization,
    });

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(1));

    rerender({...baseProps, period: '7d', memoized: true});

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(2));

    rerender({...baseProps, period: '14d', memoized: true});

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(2));
  });

  it('shares release fetches between hooks with memoize enabled', async () => {
    const first = renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, period: '42d', memoized: true},
      organization,
    });
    const second = renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, period: '42d', memoized: true},
      organization,
    });

    await waitFor(() => expect(first.result.current.releaseSeries).toHaveLength(1));
    await waitFor(() => expect(second.result.current.releaseSeries).toHaveLength(1));

    expect(releasesMock).toHaveBeenCalledTimes(1);
  });

  it('generates an eCharts `markLine` series from releases', async () => {
    const {result} = renderHookWithProviders(useReleaseSeries, {
      initialProps: baseProps,
      organization,
    });

    await waitFor(() =>
      expect(result.current.releaseSeries).toEqual([
        expect.objectContaining({
          markLine: expect.objectContaining({
            data: [
              expect.objectContaining({
                name: '1.2.0, sentry-android-shop',
                value: '1.2.0, sentry-android-shop',
                xAxis: 1584921600000,
              }),
            ],
          }),
        }),
      ])
    );
  });

  it('allows updating the emphasized release without refetching', async () => {
    releases.push({
      version: 'sentry-android-shop@1.2.1',
      date: '2020-03-24T00:00:00Z',
    });
    const {result, rerender} = renderHookWithProviders(useReleaseSeries, {
      initialProps: {...baseProps, emphasizeReleases: ['sentry-android-shop@1.2.0']},
      organization,
    });

    // Unemphasized releases render at opacity 0.3, emphasized at 0.8
    await waitFor(() =>
      expect(result.current.releaseSeries).toEqual([
        expect.objectContaining({
          markLine: expect.objectContaining({
            lineStyle: expect.objectContaining({opacity: 0.3}),
            data: [expect.objectContaining({name: '1.2.1, sentry-android-shop'})],
          }),
        }),
        expect.objectContaining({
          markLine: expect.objectContaining({
            lineStyle: expect.objectContaining({opacity: 0.8}),
            data: [expect.objectContaining({name: '1.2.0, sentry-android-shop'})],
          }),
        }),
      ])
    );

    rerender({...baseProps, emphasizeReleases: ['sentry-android-shop@1.2.1']});

    await waitFor(() =>
      expect(result.current.releaseSeries).toEqual([
        expect.objectContaining({
          markLine: expect.objectContaining({
            lineStyle: expect.objectContaining({opacity: 0.3}),
            data: [expect.objectContaining({name: '1.2.0, sentry-android-shop'})],
          }),
        }),
        expect.objectContaining({
          markLine: expect.objectContaining({
            lineStyle: expect.objectContaining({opacity: 0.8}),
            data: [expect.objectContaining({name: '1.2.1, sentry-android-shop'})],
          }),
        }),
      ])
    );
    expect(releasesMock).toHaveBeenCalledTimes(1);
  });
});
