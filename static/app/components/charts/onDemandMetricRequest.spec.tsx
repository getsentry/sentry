import {Organization} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {OnDemandMetricRequest} from 'sentry/components/charts/onDemandMetricRequest';

const SAMPLE_RATE = 0.5;

jest.mock('sentry/actionCreators/events', () => ({
  doEventsRequest: jest.fn(),
}));

describe('OnDemandMetricRequest', function () {
  const organization = Organization();
  const mock = jest.fn(() => null);

  const DEFAULTS = {
    api: new MockApiClient(),
    period: '24h',
    organization,
    includePrevious: false,
    interval: '24h',
    limit: 30,
    query: 'transaction.duration:>1',
    children: () => null,
    partial: false,
    includeTransformedData: true,
    sampleRate: SAMPLE_RATE,
  };

  describe('with props changes', function () {
    beforeAll(function () {
      (doEventsRequest as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          isMetricsData: true,
          data: [],
        })
      );
    });

    it('makes requests', async function () {
      render(<OnDemandMetricRequest {...DEFAULTS}>{mock}</OnDemandMetricRequest>);
      expect(mock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          loading: true,
        })
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            loading: false,
            timeseriesData: [
              {
                // isExtrapolatedData: true,
                seriesName: expect.anything(),
                data: [],
              },
            ],
            originalTimeseriesData: [],
          })
        )
      );

      expect(doEventsRequest).toHaveBeenCalled();
    });

    it('makes a new request if projects prop changes', function () {
      const {rerender} = render(
        <OnDemandMetricRequest {...DEFAULTS}>{mock}</OnDemandMetricRequest>
      );
      doEventsRequest as jest.Mock;

      rerender(
        <OnDemandMetricRequest {...DEFAULTS} project={[123]}>
          {mock}
        </OnDemandMetricRequest>
      );

      expect(doEventsRequest).toHaveBeenCalledTimes(2);
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          project: [123],
        })
      );
    });

    it('makes a new request if environments prop changes', function () {
      const {rerender} = render(
        <OnDemandMetricRequest {...DEFAULTS}>{mock}</OnDemandMetricRequest>
      );
      doEventsRequest as jest.Mock;

      rerender(
        <OnDemandMetricRequest {...DEFAULTS} environment={['dev']}>
          {mock}
        </OnDemandMetricRequest>
      );

      expect(doEventsRequest).toHaveBeenCalledTimes(2);
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          environment: ['dev'],
        })
      );
    });

    it('makes a new request if period prop changes', function () {
      const {rerender} = render(
        <OnDemandMetricRequest {...DEFAULTS}>{mock}</OnDemandMetricRequest>
      );
      doEventsRequest as jest.Mock;

      rerender(
        <OnDemandMetricRequest {...DEFAULTS} period="7d">
          {mock}
        </OnDemandMetricRequest>
      );

      expect(doEventsRequest).toHaveBeenCalledTimes(2);
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '7d',
        })
      );
    });
  });
});
