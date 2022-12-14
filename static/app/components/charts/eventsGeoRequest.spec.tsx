import {Fragment} from 'react';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import EventsGeoRequest, {
  EventsGeoRequestProps,
} from 'sentry/components/charts/eventsGeoRequest';
import * as genericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';

describe('EventsGeoRequest', function () {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
  const makeProps = (
    partial: Partial<EventsGeoRequestProps> = {}
  ): EventsGeoRequestProps => {
    return {
      api: new MockApiClient(),
      organization,
      yAxis: ['count()'],
      query: 'event.type:transaction',
      projects: [parseInt(project.id, 10)],
      period: '24h',
      start: new Date(),
      end: new Date(),
      environments: [],
      children: jest.fn(() => <Fragment />),
      ...partial,
    };
  };

  describe('with props changes', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('renders with loading state', async () => {
      jest
        .spyOn(genericDiscoverQuery, 'doDiscoverQuery')
        .mockResolvedValue([{data: 'test'}, undefined, undefined]);

      const mock = jest.fn(() => <Fragment />);

      render(<EventsGeoRequest {...makeProps()}>{mock}</EventsGeoRequest>);

      await waitFor(() => {
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
    });

    it('makes requests', async () => {
      jest
        .spyOn(genericDiscoverQuery, 'doDiscoverQuery')
        .mockResolvedValue([{data: 'test'}, undefined, undefined]);

      const mock = jest.fn(() => <Fragment />);
      render(<EventsGeoRequest {...makeProps()}>{mock}</EventsGeoRequest>);

      await waitFor(() => {
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            errored: false,
            loading: false,
            reloading: false,
            tableData: [{data: 'test'}],
          })
        );
      });
    });

    it('renders with error if request errors', async () => {
      jest.spyOn(genericDiscoverQuery, 'doDiscoverQuery').mockRejectedValue({});

      const mock = jest.fn(() => <Fragment />);
      render(<EventsGeoRequest {...makeProps()}>{mock}</EventsGeoRequest>);

      await waitFor(() => {
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            errored: true,
            loading: false,
            reloading: false,
            tableData: undefined,
          })
        );
      });
    });

    it.each([{query: 'event.type:error'}, {yAxis: 'failure_count()'}, {period: '12h'}])(
      'rerenders if %j prop changes',
      async (rerenderProps: Partial<EventsGeoRequestProps>) => {
        jest
          .spyOn(genericDiscoverQuery, 'doDiscoverQuery')
          .mockResolvedValue([{data: 'test'}, undefined, undefined]);

        const mock = jest.fn(() => <Fragment />);
        const {rerender} = render(
          <EventsGeoRequest {...makeProps()}>{mock}</EventsGeoRequest>
        );

        rerender(
          <EventsGeoRequest {...makeProps(rerenderProps)}>{mock}</EventsGeoRequest>
        );

        await waitFor(() => {
          expect(genericDiscoverQuery.doDiscoverQuery).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.anything(),
            expect.objectContaining(
              rerenderProps.period ? {statsPeriod: rerenderProps.period} : rerenderProps
            )
          );
        });
      }
    );
  });
});
