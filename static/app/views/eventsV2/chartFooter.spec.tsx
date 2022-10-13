import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import ChartFooter from 'sentry/views/eventsV2/chartFooter';

describe('EventsV2 > ChartFooter', function () {
  const features = ['discover-basic'];
  const yAxisValue = ['count()', 'failure_count()'];
  const yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
  ];
  const project = TestStubs.Project();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'count()'],
    projects: [project.id],
  });

  afterEach(function () {});

  it('renders yAxis option using OptionCheckboxSelector using entire yAxisValue', function () {
    const organization = TestStubs.Organization({
      features: [...features],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxisValue}
        yAxisOptions={yAxisOptions}
        onAxisChange={() => undefined}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(chartFooter, {context: initialData.routerContext});

    expect(
      screen.getByRole('button', {
        name: `Y-Axis ${yAxisValue[0]} +${
          yAxisValue.filter(v => v !== yAxisValue[0]).length
        }`,
      })
    ).toBeInTheDocument();
  });

  it('renders display limits with default limit when top 5 mode is selected', function () {
    const organization = TestStubs.Organization({
      features,
    });
    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    const limit = '5';

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxisValue}
        yAxisOptions={yAxisOptions}
        onAxisChange={() => undefined}
        displayMode={DisplayModes.TOP5}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents={limit}
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(chartFooter, {context: initialData.routerContext});

    expect(screen.getByRole('button', {name: `Limit ${limit}`})).toBeInTheDocument();
  });

  it('renders multi value y-axis dropdown selector on a non-Top display', function () {
    const organization = TestStubs.Organization({
      features,
    });
    let yAxis = ['count()'];

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxis}
        yAxisOptions={yAxisOptions}
        onAxisChange={newYAxis => (yAxis = newYAxis)}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(chartFooter);

    userEvent.click(screen.getByText('count()'));
    userEvent.click(screen.getByText('failure_count()'));
    expect(yAxis).toEqual(['count()', 'failure_count()']);
  });
});
