import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EventView} from 'sentry/utils/discover/eventView';
import {DISPLAY_MODE_OPTIONS, DisplayModes} from 'sentry/utils/discover/types';
import {ResultsChartContainer} from 'sentry/views/discover/results/resultsChart';

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
      <ResultsChart
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
      <ResultsChart
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
});
