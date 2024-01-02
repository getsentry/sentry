import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {DISPLAY_MODE_OPTIONS, DisplayModes} from 'sentry/utils/discover/types';
import ResultsChart from 'sentry/views/discover/resultsChart';

describe('Discover > ResultsChart', function () {
  const features = ['discover-basic'];
  const location = LocationFixture({
    query: {query: 'tag:value'},
    pathname: '/',
  });

  const organization = Organization({
    features,
    projects: [ProjectFixture()],
  });

  const initialData = initializeOrg({
    organization,
    router: {
      location,
    },
    projects: [],
  });

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

  it('only allows default, daily, previous period, and bar display modes when multiple y axis are selected', async function () {
    render(
      <ResultsChart
        router={RouterFixture()}
        organization={organization}
        eventView={eventView}
        location={location}
        onAxisChange={() => undefined}
        onIntervalChange={() => undefined}
        onDisplayChange={() => undefined}
        total={1}
        confirmedQuery
        yAxis={['count()', 'failure_count()']}
        onTopEventsChange={() => {}}
      />,
      {context: initialData.routerContext}
    );

    await userEvent.click(screen.getByText(/Display/));

    DISPLAY_MODE_OPTIONS.forEach(({value, label}) => {
      if (
        [
          DisplayModes.DEFAULT,
          DisplayModes.DAILY,
          DisplayModes.PREVIOUS,
          DisplayModes.BAR,
        ].includes(value as DisplayModes)
      ) {
        expect(screen.getByRole('option', {name: String(label)})).toBeEnabled();
      }
    });
  });

  it('does not display a chart if no y axis is selected', function () {
    render(
      <ResultsChart
        router={RouterFixture()}
        organization={organization}
        eventView={eventView}
        location={location}
        onAxisChange={() => undefined}
        onDisplayChange={() => undefined}
        onIntervalChange={() => undefined}
        total={1}
        confirmedQuery
        yAxis={[]}
        onTopEventsChange={() => {}}
      />,
      {context: initialData.routerContext}
    );

    expect(screen.getByText(/No Y-Axis selected/)).toBeInTheDocument();
  });
});
