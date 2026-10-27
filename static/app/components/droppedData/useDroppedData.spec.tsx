import {Fragment, useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {HOUR, MINUTE} from 'sentry/utils/formatters';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

const droppedEvents = [OutcomeRowFixture({count: 10})];
const acceptedEvents = [OutcomeRowFixture({outcome: 'accepted', count: 90})];

function droppedEventsBody() {
  return {
    meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
    droppedEvents,
    acceptedEvents,
  };
}

function DroppedDataConsumer() {
  const {isPending} = useDroppedData({dataset: DiscoverDatasets.SPANS, interval: '1h'});
  return isPending ? null : <span>Loaded</span>;
}

function ChartWithLateConsumer() {
  const [hasLateConsumer, setHasLateConsumer] = useState(false);
  return (
    <Fragment>
      <DroppedDataConsumer />
      {hasLateConsumer && <DroppedDataConsumer />}
      <Button onClick={() => setHasLateConsumer(true)}>Mount late consumer</Button>
    </Fragment>
  );
}

describe('useDroppedData', () => {
  beforeEach(() => {
    PageFiltersStore.reset();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  it('requests dropped events and returns them', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: droppedEventsBody(),
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.SPANS, interval: '1h'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-dropped/`,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: DiscoverDatasets.SPANS,
          interval: '1h',
          referrer: 'api.explore.dropped-data-annotations',
        }),
      })
    );
    expect(request.mock.calls[0][1].query).not.toHaveProperty('yAxis');
    expect(result.current.droppedEvents).toEqual(droppedEvents);
    expect(result.current.acceptedEvents).toEqual(acceptedEvents);
  });

  it('requests trace metrics without a chart aggregate', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: droppedEventsBody(),
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.TRACEMETRICS, interval: '1h'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-dropped/`,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: DiscoverDatasets.TRACEMETRICS,
          referrer: 'api.explore.dropped-data-annotations',
        }),
      })
    );
    expect(request.mock.calls[0][1].query).not.toHaveProperty('yAxis');
    expect(result.current.droppedEvents).toEqual(droppedEvents);
  });

  it('does not request dropped events without the feature flag', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: droppedEventsBody(),
    });

    const {result} = renderHookWithProviders(
      () => useDroppedData({dataset: DiscoverDatasets.SPANS, interval: '1h'}),
      {organization: OrganizationFixture({features: []})}
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.current.droppedEvents).toBeUndefined();
  });

  describe('on a relative range', () => {
    const now = new Date('2026-01-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers({advanceTimers: true});
      jest.setSystemTime(now);
      PageFiltersStore.onInitializeUrlState(
        PageFiltersFixture({
          datetime: {start: null, end: null, period: '14d', utc: null},
        })
      );
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    it('reuses data until one interval has passed', async () => {
      const request = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-dropped/`,
        body: droppedEventsBody(),
      });

      render(<ChartWithLateConsumer />, {organization});
      expect(await screen.findByText('Loaded')).toBeInTheDocument();

      jest.setSystemTime(now.getTime() + 30 * MINUTE);
      await userEvent.click(screen.getByRole('button', {name: 'Mount late consumer'}));

      expect(await screen.findAllByText('Loaded')).toHaveLength(2);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('refetches after one interval has passed', async () => {
      const request = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-dropped/`,
        body: droppedEventsBody(),
      });

      render(<ChartWithLateConsumer />, {organization});
      expect(await screen.findByText('Loaded')).toBeInTheDocument();

      jest.setSystemTime(now.getTime() + HOUR + MINUTE);
      await userEvent.click(screen.getByRole('button', {name: 'Mount late consumer'}));

      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    });
  });
});
