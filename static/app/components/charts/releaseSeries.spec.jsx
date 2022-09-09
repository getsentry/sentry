import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ReleaseSeries from 'sentry/components/charts/releaseSeries';

describe('ReleaseSeries', function () {
  const renderFunc = jest.fn(() => null);
  const organization = TestStubs.Organization();
  let releases;
  let releasesMock;

  beforeEach(function () {
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

  it('does not fetch releases if releases is truthy', function () {
    render(
      <ReleaseSeries organization={organization} releases={[]}>
        {renderFunc}
      </ReleaseSeries>
    );

    expect(releasesMock).not.toHaveBeenCalled();
  });

  it('fetches releases if no releases passed through props', async function () {
    render(<ReleaseSeries>{renderFunc}</ReleaseSeries>);

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
    render(<ReleaseSeries projects={[1, 2]}>{renderFunc}</ReleaseSeries>);

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {project: [1, 2]},
        })
      )
    );
  });

  it('fetches releases with environment conditions', async function () {
    render(<ReleaseSeries environments={['dev', 'test']}>{renderFunc}</ReleaseSeries>);

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {environment: ['dev', 'test']},
        })
      )
    );
  });

  it('fetches releases with start and end date strings', async function () {
    render(
      <ReleaseSeries start="2020-01-01" end="2020-01-31">
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {start: '2020-01-01T00:00:00', end: '2020-01-31T00:00:00'},
        })
      )
    );
  });

  it('fetches releases with start and end dates', async function () {
    const start = new Date(Date.UTC(2020, 0, 1, 12, 13, 14));
    const end = new Date(Date.UTC(2020, 0, 31, 14, 15, 16));
    render(
      <ReleaseSeries start={start} end={end}>
        {renderFunc}
      </ReleaseSeries>
    );

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {start: '2020-01-01T12:13:14', end: '2020-01-31T14:15:16'},
        })
      )
    );
  });

  it('fetches releases with period', async function () {
    render(<ReleaseSeries period="14d">{renderFunc}</ReleaseSeries>);

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {statsPeriod: '14d'},
        })
      )
    );
  });

  it('fetches on property updates', function () {
    const wrapper = render(<ReleaseSeries period="14d">{renderFunc}</ReleaseSeries>);

    const cases = [
      {period: '7d'},
      {start: '2020-01-01', end: '2020-01-02'},
      {projects: [1]},
    ];
    for (const scenario of cases) {
      releasesMock.mockReset();

      wrapper.rerender(<ReleaseSeries {...scenario}>{renderFunc}</ReleaseSeries>);

      expect(releasesMock).toHaveBeenCalled();
    }
  });

  it('doesnt not refetch releases with memoize enabled', function () {
    const originalPeriod = '14d';
    const updatedPeriod = '7d';
    const wrapper = render(
      <ReleaseSeries period={originalPeriod} memoized>
        {renderFunc}
      </ReleaseSeries>
    );

    expect(releasesMock).toHaveBeenCalledTimes(1);

    wrapper.rerender(
      <ReleaseSeries period={updatedPeriod} memoized>
        {renderFunc}
      </ReleaseSeries>
    );

    expect(releasesMock).toHaveBeenCalledTimes(2);

    wrapper.rerender(
      <ReleaseSeries period={originalPeriod} memoized>
        {renderFunc}
      </ReleaseSeries>
    );

    expect(releasesMock).toHaveBeenCalledTimes(2);
  });

  it('generates an eCharts `markLine` series from releases', async function () {
    render(<ReleaseSeries>{renderFunc}</ReleaseSeries>);

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
      <ReleaseSeries emphasizeReleases={['sentry-android-shop@1.2.0']}>
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
      <ReleaseSeries emphasizeReleases={['sentry-android-shop@1.2.1']}>
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
