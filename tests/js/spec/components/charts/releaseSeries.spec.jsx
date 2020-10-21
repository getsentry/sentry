import {mount} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ReleaseSeries from 'app/components/charts/releaseSeries';

describe('ReleaseSeries', function () {
  const renderFunc = jest.fn(() => null);
  const {routerContext, organization} = initializeOrg();
  const releases = [TestStubs.Release()];
  let releasesMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    releasesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: releases,
    });
  });

  it('does not fetch releases if releases is truthy', function () {
    mount(
      <ReleaseSeries organization={organization} releases={[]}>
        {renderFunc}
      </ReleaseSeries>,
      routerContext
    );

    expect(releasesMock).not.toHaveBeenCalled();
  });

  it('fetches releases if no releases passed through props', async function () {
    const wrapper = mount(<ReleaseSeries>{renderFunc}</ReleaseSeries>, routerContext);

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalled();

    expect(renderFunc).toHaveBeenCalledWith(
      expect.objectContaining({
        releases,
      })
    );
  });

  it('fetches releases with project conditions', async function () {
    const wrapper = mount(
      <ReleaseSeries projects={[1, 2]}>{renderFunc}</ReleaseSeries>,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {project: [1, 2]},
      })
    );
  });

  it('fetches releases with environment conditions', async function () {
    const wrapper = mount(
      <ReleaseSeries environments={['dev', 'test']}>{renderFunc}</ReleaseSeries>,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {environment: ['dev', 'test']},
      })
    );
  });

  it('fetches releases with start and end date strings', async function () {
    const wrapper = mount(
      <ReleaseSeries start="2020-01-01" end="2020-01-31">
        {renderFunc}
      </ReleaseSeries>,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {start: '2020-01-01T00:00:00', end: '2020-01-31T00:00:00'},
      })
    );
  });

  it('fetches releases with start and end dates', async function () {
    const start = new Date(Date.UTC(2020, 0, 1, 12, 13, 14));
    const end = new Date(Date.UTC(2020, 0, 31, 14, 15, 16));
    const wrapper = mount(
      <ReleaseSeries start={start} end={end}>
        {renderFunc}
      </ReleaseSeries>,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {start: '2020-01-01T12:13:14', end: '2020-01-31T14:15:16'},
      })
    );
  });

  it('fetches releases with period', async function () {
    const wrapper = mount(
      <ReleaseSeries period="14d">{renderFunc}</ReleaseSeries>,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(releasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {statsPeriod: '14d'},
      })
    );
  });

  it('fetches on property updates', async function () {
    const wrapper = mount(
      <ReleaseSeries period="14d">{renderFunc}</ReleaseSeries>,
      routerContext
    );
    await tick();
    wrapper.update();

    const cases = [
      {period: '7d'},
      {start: '2020-01-01', end: '2020-01-02'},
      {projects: [1]},
    ];
    for (const scenario of cases) {
      releasesMock.mockReset();

      wrapper.setProps(scenario);
      wrapper.update();
      await tick();

      expect(releasesMock).toHaveBeenCalled();
    }
  });

  it('generates an eCharts `markLine` series from releases', async function () {
    const wrapper = mount(<ReleaseSeries>{renderFunc}</ReleaseSeries>, routerContext);

    await tick();
    wrapper.update();

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
    );
  });
});
