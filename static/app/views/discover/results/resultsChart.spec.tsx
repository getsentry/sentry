import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {EventView} from 'sentry/utils/discover/eventView';
import {
  DiscoverDatasets,
  DISPLAY_MODE_OPTIONS,
  DisplayModes,
} from 'sentry/utils/discover/types';

import {ResultsChartContainer} from './resultsChart';

describe('Discover > ResultsChart', () => {
  const features = ['discover-basic'];
  const location = LocationFixture({
    query: {query: 'tag:value'},
    pathname: '/',
  });

  const organization = OrganizationFixture({features});

  const eventView = EventView.fromSavedQueryOrLocation(undefined, location);

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
  });

  it('only allows default, daily, previous period, and bar display modes when multiple y axis are selected', async () => {
    render(
      <ResultsChartContainer
        organization={organization}
        eventView={eventView}
        location={location}
        onAxisChange={() => {}}
        onIntervalChange={() => {}}
        onDisplayChange={() => {}}
        total={1}
        confirmedQuery
        yAxis={['count()', 'failure_count()']}
        onTopEventsChange={() => {}}
      />
    );

    await userEvent.click(screen.getByText(/Display/));

    DISPLAY_MODE_OPTIONS.forEach(({value, label}) => {
      if (
        [
          DisplayModes.DEFAULT,
          DisplayModes.DAILY,
          DisplayModes.PREVIOUS,
          DisplayModes.BAR,
        ].includes(value)
      ) {
        expect(screen.getByRole('option', {name: String(label)})).toBeEnabled();
      }
    });
  });

  it('does not display a chart if no y axis is selected', async () => {
    render(
      <ResultsChartContainer
        organization={organization}
        eventView={eventView}
        location={location}
        onAxisChange={() => {}}
        onDisplayChange={() => {}}
        onIntervalChange={() => {}}
        total={1}
        confirmedQuery
        yAxis={[]}
        onTopEventsChange={() => {}}
      />
    );

    expect(await screen.findByText(/No Y-Axis selected/)).toBeInTheDocument();
  });

  it('uses the selected interval for bar charts', async () => {
    const barLocation = LocationFixture({
      pathname: '/',
      query: {
        display: DisplayModes.BAR,
        interval: '1h',
        statsPeriod: '30d',
        yAxis: 'count()',
      },
    });
    const barEventView = EventView.fromSavedQueryOrLocation(undefined, barLocation);
    const hourlyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
      match: [MockApiClient.matchQuery({interval: '1h'})],
    });
    const dailyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
      match: [MockApiClient.matchQuery({interval: '1d'})],
    });

    render(
      <ResultsChartContainer
        organization={organization}
        eventView={barEventView}
        location={barLocation}
        onAxisChange={() => {}}
        onDisplayChange={() => {}}
        onIntervalChange={() => {}}
        total={1}
        confirmedQuery
        yAxis={['count()']}
        onTopEventsChange={() => {}}
      />
    );

    await waitFor(() => expect(hourlyRequest).toHaveBeenCalled());
    expect(dailyRequest).not.toHaveBeenCalled();
  });

  it('uses a low-fidelity interval for bar charts without a selected interval', async () => {
    const barLocation = LocationFixture({
      pathname: '/',
      query: {
        display: DisplayModes.BAR,
        statsPeriod: '30d',
        yAxis: 'count()',
      },
    });
    const barEventView = EventView.fromSavedQueryOrLocation(undefined, barLocation);
    const dailyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
      match: [MockApiClient.matchQuery({interval: '1d'})],
    });

    render(
      <ResultsChartContainer
        organization={organization}
        eventView={barEventView}
        location={barLocation}
        onAxisChange={() => {}}
        onDisplayChange={() => {}}
        onIntervalChange={() => {}}
        total={1}
        confirmedQuery
        yAxis={['count()']}
        onTopEventsChange={() => {}}
      />
    );

    await waitFor(() => expect(dailyRequest).toHaveBeenCalled());
  });

  describe('dropped data layer', () => {
    const droppedDataOrganization = OrganizationFixture({
      features: [...features, 'explore-data-fidelity-annotations'],
    });

    beforeEach(() => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    });

    afterEach(() => {
      PageFiltersStore.reset();
    });

    function mockDroppedData({
      asyncDelay,
      statsPeriod,
    }: {asyncDelay?: Promise<void>; statsPeriod?: string} = {}) {
      return MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-dropped/',
        method: 'GET',
        match: [
          MockApiClient.matchQuery({
            referrer: 'api.explore.dropped-data-annotations',
            ...(statsPeriod ? {statsPeriod} : {}),
          }),
        ],
        body: {
          meta: {dataset: 'errors', start: 0, end: 0, interval: 0},
          droppedEvents: [OutcomeRowFixture({category: 'error'})],
          acceptedEvents: [],
        },
        asyncDelay,
      });
    }

    function deferred() {
      let resolve!: () => void;
      const promise = new Promise<void>(r => {
        resolve = r;
      });
      return {promise, resolve};
    }

    function chartElement(dataset: DiscoverDatasets, statsPeriod = '14d') {
      const datasetLocation = LocationFixture({
        pathname: '/',
        query: {dataset, interval: '1h', statsPeriod, yAxis: 'count()'},
      });
      return (
        <ResultsChartContainer
          organization={droppedDataOrganization}
          eventView={EventView.fromSavedQueryOrLocation(undefined, datasetLocation)}
          location={datasetLocation}
          onAxisChange={() => {}}
          onDisplayChange={() => {}}
          onIntervalChange={() => {}}
          total={1}
          confirmedQuery
          yAxis={['count()']}
          onTopEventsChange={() => {}}
        />
      );
    }

    function renderChart(dataset: DiscoverDatasets) {
      return render(chartElement(dataset), {organization: droppedDataOrganization});
    }

    it('keeps the loading placeholder until the dropped data arrives', async () => {
      const droppedData = deferred();
      mockDroppedData({asyncDelay: droppedData.promise});
      const eventsStatsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: [],
      });

      renderChart(DiscoverDatasets.ERRORS);

      await waitFor(() => expect(eventsStatsMock).toHaveBeenCalled());
      expect(screen.getByTestId('events-request-loading')).toBeInTheDocument();

      await act(async () => {
        droppedData.resolve();
        await droppedData.promise;
      });

      await waitFor(() =>
        expect(screen.queryByTestId('events-request-loading')).not.toBeInTheDocument()
      );
    });

    it('keeps the drawn chart under the loading mask when the time range changes', async () => {
      mockDroppedData();
      const {rerender} = renderChart(DiscoverDatasets.ERRORS);
      expect(await screen.findByLabelText('Chart layers')).toBeInTheDocument();

      const droppedData = deferred();
      mockDroppedData({asyncDelay: droppedData.promise, statsPeriod: '7d'});
      const eventsStatsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: [],
        match: [MockApiClient.matchQuery({statsPeriod: '7d'})],
      });

      act(() => {
        PageFiltersStore.updateDateTime({
          period: '7d',
          start: null,
          end: null,
          utc: null,
        });
      });
      rerender(chartElement(DiscoverDatasets.ERRORS, '7d'));

      await waitFor(() => expect(eventsStatsMock).toHaveBeenCalled());
      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
      expect(screen.queryByTestId('events-request-loading')).not.toBeInTheDocument();

      await act(async () => {
        droppedData.resolve();
        await droppedData.promise;
      });

      await waitFor(() =>
        expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument()
      );
      expect(screen.queryByTestId('events-request-loading')).not.toBeInTheDocument();
    });

    it('shows the Layers control when errors were dropped', async () => {
      const droppedDataMock = mockDroppedData();

      renderChart(DiscoverDatasets.ERRORS);

      expect(await screen.findByLabelText('Chart layers')).toBeInTheDocument();
      expect(droppedDataMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-dropped/',
        expect.objectContaining({
          query: expect.objectContaining({dataset: 'errors', interval: '1h'}),
        })
      );
    });

    it('does not request dropped data for other datasets', async () => {
      const droppedDataMock = mockDroppedData();

      renderChart(DiscoverDatasets.TRANSACTIONS);

      expect(await screen.findByText(/Display/)).toBeInTheDocument();
      expect(droppedDataMock).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Chart layers')).not.toBeInTheDocument();
    });

    it('keeps the Layers control after hiding the dropped data layer', async () => {
      mockDroppedData();

      renderChart(DiscoverDatasets.ERRORS);

      await userEvent.click(await screen.findByLabelText('Chart layers'));
      await userEvent.click(screen.getByRole('option', {name: 'Dropped Errors'}));

      expect(screen.getByLabelText('Chart layers')).toBeInTheDocument();
    });
  });
});
