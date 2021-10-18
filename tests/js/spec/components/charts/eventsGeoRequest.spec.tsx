import {act} from 'react-dom/test-utils';

import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import EventsGeoRequest from 'app/components/charts/eventsGeoRequest';
import * as genericDiscoverQuery from 'app/utils/discover/genericDiscoverQuery';

describe('EventsRequest', function () {
  // @ts-expect-error
  const project = TestStubs.Project();
  // @ts-expect-error
  const organization = TestStubs.Organization();
  const mock = jest.fn(() => null);
  const DEFAULTS = {
    // @ts-expect-error
    api: new MockApiClient(),
    organization,
    yAxis: ['count()'],
    query: 'event.type:transaction',
    projects: [parseInt(project.id, 10)],
    period: '24h',
    start: new Date(),
    end: new Date(),
    environments: [],
  };

  let wrapper;

  describe('with props changes', function () {
    beforeEach(async function () {
      mock.mockClear();
      // @ts-expect-error
      jest.spyOn(genericDiscoverQuery, 'doDiscoverQuery').mockImplementation(() => {
        return Promise.resolve([
          {
            data: 'test',
          },
        ]);
      });
      await act(async () => {
        wrapper = mountWithTheme(
          // @ts-expect-error
          <EventsGeoRequest {...DEFAULTS}>{mock}</EventsGeoRequest>
        );
        return wrapper;
      });
    });

    it('renders with loading state', async function () {
      expect(mock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          errored: false,
          loading: true,
          reloading: false,
          tableData: undefined,
        })
      );
    });

    it('makes requests', async function () {
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errored: false,
          loading: false,
          reloading: false,
          tableData: [{data: 'test'}],
        })
      );
    });

    it('renders with error if request errors', async function () {
      // @ts-expect-error
      jest.spyOn(genericDiscoverQuery, 'doDiscoverQuery').mockImplementation(() => {
        return Promise.reject();
      });
      await act(async () => {
        wrapper = mountWithTheme(
          // @ts-expect-error
          <EventsGeoRequest {...DEFAULTS}>{mock}</EventsGeoRequest>
        );
        return wrapper;
      });
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errored: true,
          loading: false,
          reloading: false,
          tableData: undefined,
        })
      );
    });

    it('makes a new request if query prop changes', async function () {
      await act(async () => {
        wrapper.rerender(
          <EventsGeoRequest {...DEFAULTS} query="event.type:error">
            {/* @ts-expect-error */}
            {mock}
          </EventsGeoRequest>
        );
      });
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errored: false,
          loading: false,
          reloading: false,
          tableData: [{data: 'test'}],
        })
      );
      expect(genericDiscoverQuery.doDiscoverQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          query: 'event.type:error',
        })
      );
    });

    it('makes a new request if yAxis prop changes', async function () {
      await act(async () => {
        wrapper.rerender(
          <EventsGeoRequest {...DEFAULTS} yAxis={['failure_count()']}>
            {/* @ts-expect-error */}
            {mock}
          </EventsGeoRequest>
        );
      });
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errored: false,
          loading: false,
          reloading: false,
          tableData: [{data: 'test'}],
        })
      );
      expect(genericDiscoverQuery.doDiscoverQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          yAxis: 'failure_count()',
        })
      );
    });

    it('makes a new request if period prop changes', async function () {
      await act(async () => {
        wrapper.rerender(
          <EventsGeoRequest {...DEFAULTS} period="12h">
            {/* @ts-expect-error */}
            {mock}
          </EventsGeoRequest>
        );
      });
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errored: false,
          loading: false,
          reloading: false,
          tableData: [{data: 'test'}],
        })
      );
      expect(genericDiscoverQuery.doDiscoverQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          statsPeriod: '12h',
        })
      );
    });
  });
});
