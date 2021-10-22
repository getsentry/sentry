import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';
import {DisplayModes} from 'app/utils/discover/types';
import ResultsChart from 'app/views/eventsV2/resultsChart';

describe('EventsV2 > ResultsChart', function () {
  const features = ['discover-basic', 'connect-discover-and-dashboards'];
  const location = {
    query: {query: 'tag:value'},
    pathname: '/',
  };

  let organization, eventView, initialData;

  beforeEach(() => {
    // @ts-expect-error
    organization = TestStubs.Organization({
      features,
      // @ts-expect-error
      projects: [TestStubs.Project()],
    });
    initialData = initializeOrg({
      organization,
      router: {
        location,
      },
      project: 1,
      projects: [],
    });
    // @ts-expect-error
    eventView = EventView.fromSavedQueryOrLocation(undefined, location);
  });

  it('only allows default, daily, previous period, and bar display modes when multiple y axis are selected', async function () {
    const wrapper = mountWithTheme(
      <ResultsChart
        // @ts-expect-error
        router={TestStubs.router()}
        organization={organization}
        eventView={eventView}
        // @ts-expect-error
        location={location}
        onAxisChange={() => undefined}
        onDisplayChange={() => undefined}
        total={1}
        confirmedQuery
        yAxis={['count()', 'failure_count()']}
      />,
      initialData.routerContext
    );
    const displayOptions = wrapper.find('ChartFooter').props().displayOptions;
    displayOptions.forEach(({value, disabled}) => {
      if (
        ![
          DisplayModes.DEFAULT,
          DisplayModes.DAILY,
          DisplayModes.PREVIOUS,
          DisplayModes.BAR,
        ].includes(value)
      ) {
        expect(disabled).toBe(true);
      }
    });
  });

  it('does not display a chart if no y axis is selected', async function () {
    const wrapper = mountWithTheme(
      <ResultsChart
        // @ts-expect-error
        router={TestStubs.router()}
        organization={organization}
        eventView={eventView}
        // @ts-expect-error
        location={location}
        onAxisChange={() => undefined}
        onDisplayChange={() => undefined}
        total={1}
        confirmedQuery
        yAxis={[]}
      />,
      initialData.routerContext
    );
    expect(wrapper.find('NoChartContainer').children().children().html()).toEqual(
      t('No Y-Axis selected.')
    );
  });

  it('disables other y-axis options when not in default, daily, previous period, or bar display mode', async function () {
    eventView.display = DisplayModes.WORLDMAP;
    const wrapper = mountWithTheme(
      <ResultsChart
        // @ts-expect-error
        router={TestStubs.router()}
        organization={organization}
        eventView={eventView}
        // @ts-expect-error
        location={location}
        onAxisChange={() => undefined}
        onDisplayChange={() => undefined}
        total={1}
        confirmedQuery
        yAxis={['count()']}
      />,
      initialData.routerContext
    );
    const yAxisOptions = wrapper.find('ChartFooter').props().yAxisOptions;
    yAxisOptions.forEach(({value, disabled}) => {
      if (value !== 'count()') {
        expect(disabled).toBe(true);
      }
    });
  });
});
