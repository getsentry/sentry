import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import ChartFooter from 'sentry/views/discover/chartFooter';

describe('Discover > ChartFooter', function () {
  const features = ['discover-basic'];
  const yAxisValue = ['count()', 'failure_count()'];
  const yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
  ];
  const project = ProjectFixture();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'count()'],
    projects: [parseInt(project.id, 10)],
  });

  afterEach(function () {});

  it('renders yAxis option using OptionCheckboxSelector using entire yAxisValue', function () {
    const organization = Organization({
      features: [...features],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      projects: [],
    });

    const chartFooter = (
      <ChartFooter
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
    const organization = Organization({
      features,
    });
    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      projects: [],
    });

    const limit = '5';

    const chartFooter = (
      <ChartFooter
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
        eventView={eventView}
      />
    );

    render(chartFooter, {context: initialData.routerContext});

    expect(screen.getByRole('button', {name: `Limit ${limit}`})).toBeInTheDocument();
  });

  it('renders multi value y-axis dropdown selector on a non-Top display', async function () {
    let yAxis = ['count()'];

    const chartFooter = (
      <ChartFooter
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
        eventView={eventView}
      />
    );

    render(chartFooter);

    await userEvent.click(screen.getByText('count()'));
    await userEvent.click(screen.getByText('failure_count()'));
    expect(yAxis).toEqual(['count()', 'failure_count()']);
  });
});
