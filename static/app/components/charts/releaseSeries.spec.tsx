import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ReleaseSeriesProps} from 'sentry/components/charts/releaseSeries';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {lightTheme} from 'sentry/utils/theme';

describe('ReleaseSeries', function () {
  const renderFunc = jest.fn(() => null);
  const organization = OrganizationFixture();
  let releases: any;
  let releasesMock: any;

  beforeEach(function () {
    jest.resetAllMocks();

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

  const router = RouterFixture();
  const baseSeriesProps: ReleaseSeriesProps = {
    api: new MockApiClient(),
    organization: OrganizationFixture(),
    period: '14d',
    start: null,
    end: null,
    utc: false,
    projects: [],
    query: '',
    environments: [],
    children: renderFunc,
    params: router.params,
    routes: router.routes,
    router,
    location: router.location,
    theme: lightTheme,
  };

  it('does not fetch releases if releases is truthy', function () {
    render(
      <ReleaseSeries {...baseSeriesProps} organization={organization} releases={[]}>
        {renderFunc}
      </ReleaseSeries>
    );

    expect(releasesMock).not.toHaveBeenCalled();
  });

  it('fetches releases if no releases passed through props', async function () {
    render(<ReleaseSeries {...baseSeriesProps}>{renderFunc}</ReleaseSeries>);

    expect(releasesMock).toHaveBeenCalled();

    await waitFor(() =>
      expect(renderFunc).toHaveBeenCalledWith(
        expect.objectContaining({
          releases,
        })
      )
    );
  });

  it('fetches releases with project conditions', async function () {
    render(
      <ReleaseSeries {...baseSeriesProps} projects={[1, 2]}>
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({project: [1, 2]}),
        })
      )
    );
  });

  it('fetches releases with environment conditions', async function () {
    render(
      <ReleaseSeries {...baseSeriesProps} environments={['dev', 'test']}>
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({environment: ['dev', 'test']}),
        })
      )
    );
  });

  it('fetches releases with start and end date strings', async function () {
    render(
      <ReleaseSeries {...baseSeriesProps} start="2020-01-01" end="2020-01-31">
        {renderFunc}
      </ReleaseSeries>
    );

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

  it('fetches releases with start and end dates', async function () {
    const start = new Date(Date.UTC(2020, 0, 1, 12, 13, 14));
    const end = new Date(Date.UTC(2020, 0, 31, 14, 15, 16));
    render(
      <ReleaseSeries {...baseSeriesProps} start={start} end={end}>
        {renderFunc}
      </ReleaseSeries>
    );

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

  it('fetches releases with period', async function () {
    render(
      <ReleaseSeries {...baseSeriesProps} period="14d">
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({statsPeriod: '14d'}),
        })
      )
    );
  });

  it('fetches on property updates', async function () {
    const wrapper = render(
      <ReleaseSeries {...baseSeriesProps} period="14d">
        {renderFunc}
      </ReleaseSeries>
    );

    const cases = [
      {period: '7d'},
      {start: '2020-01-01', end: '2020-01-02'},
      {projects: [1]},
    ];
    for (const scenario of cases) {
      releasesMock.mockReset();

      wrapper.rerender(
        <ReleaseSeries {...baseSeriesProps} {...scenario}>
          {renderFunc}
        </ReleaseSeries>
      );

      expect(releasesMock).toHaveBeenCalled();
    }

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(1));
  });

  it('doesnt not refetch releases with memoize enabled', async function () {
    const originalPeriod = '14d';
    const updatedPeriod = '7d';
    const wrapper = render(
      <ReleaseSeries {...baseSeriesProps} period={originalPeriod} memoized>
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(1));

    wrapper.rerender(
      <ReleaseSeries {...baseSeriesProps} period={updatedPeriod} memoized>
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(2));

    wrapper.rerender(
      <ReleaseSeries {...baseSeriesProps} period={originalPeriod} memoized>
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(2));
  });

  it('shares release fetches between components with memoize enabled', async function () {
    render(
      <Fragment>
        <ReleaseSeries {...baseSeriesProps} period="42d" memoized>
          {({releaseSeries}) => {
            return releaseSeries.length > 0 ? <span>Series 1</span> : null;
          }}
        </ReleaseSeries>
        <ReleaseSeries {...baseSeriesProps} period="42d" memoized>
          {({releaseSeries}) => {
            return releaseSeries.length > 0 ? <span>Series 2</span> : null;
          }}
        </ReleaseSeries>
      </Fragment>
    );

    await screen.findByText('Series 1');
    await screen.findByText('Series 2');

    await waitFor(() => expect(releasesMock).toHaveBeenCalledTimes(1));
  });

  it('generates an eCharts `markLine` series from releases', async function () {
    render(<ReleaseSeries {...baseSeriesProps}>{renderFunc}</ReleaseSeries>);

    await waitFor(() =>
      expect(renderFunc).toHaveBeenCalledWith(
        expect.objectContaining({
          releaseSeries: [
            expect.objectContaining({
              // we don't care about the other properties for now
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
          ],
        })
      )
    );
  });

  it('allows updating the emphasized release', async function () {
    releases.push({
      version: 'sentry-android-shop@1.2.1',
      date: '2020-03-24T00:00:00Z',
    });
    const wrapper = render(
      <ReleaseSeries
        {...baseSeriesProps}
        emphasizeReleases={['sentry-android-shop@1.2.0']}
      >
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() =>
      expect(renderFunc).toHaveBeenCalledWith(
        expect.objectContaining({
          releaseSeries: [
            expect.objectContaining({
              // we don't care about the other properties for now
              markLine: expect.objectContaining({
                // the unemphasized releases have opacity 0.3
                lineStyle: expect.objectContaining({opacity: 0.3}),
                data: [
                  expect.objectContaining({
                    name: '1.2.1, sentry-android-shop',
                    value: '1.2.1, sentry-android-shop',
                    xAxis: 1585008000000,
                  }),
                ],
              }),
            }),
            expect.objectContaining({
              // we don't care about the other properties for now
              markLine: expect.objectContaining({
                // the emphasized releases have opacity 0.8
                lineStyle: expect.objectContaining({opacity: 0.8}),
                data: [
                  expect.objectContaining({
                    name: '1.2.0, sentry-android-shop',
                    value: '1.2.0, sentry-android-shop',
                    xAxis: 1584921600000,
                  }),
                ],
              }),
            }),
          ],
        })
      )
    );

    wrapper.rerender(
      <ReleaseSeries
        {...baseSeriesProps}
        emphasizeReleases={['sentry-android-shop@1.2.1']}
      >
        {renderFunc}
      </ReleaseSeries>
    );

    expect(renderFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseSeries: [
          expect.objectContaining({
            // we don't care about the other properties for now
            markLine: expect.objectContaining({
              // the unemphasized releases have opacity 0.3
              lineStyle: expect.objectContaining({opacity: 0.3}),
              data: [
                expect.objectContaining({
                  name: '1.2.1, sentry-android-shop',
                  value: '1.2.1, sentry-android-shop',
                  xAxis: 1585008000000,
                }),
              ],
            }),
          }),
          expect.objectContaining({
            // we don't care about the other properties for now
            markLine: expect.objectContaining({
              // the emphasized releases have opacity 0.8
              lineStyle: expect.objectContaining({opacity: 0.8}),
              data: [
                expect.objectContaining({
                  name: '1.2.0, sentry-android-shop',
                  value: '1.2.0, sentry-android-shop',
                  xAxis: 1584921600000,
                }),
              ],
            }),
          }),
        ],
      })
    );
  });
});
