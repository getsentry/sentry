import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {RouteContext} from 'sentry/views/routeContext';

function renderWithRouter(component) {
  const memoryHistory = createMemoryHistory();

  render(
    <Router
      history={memoryHistory}
      render={props => {
        return (
          <RouteContext.Provider value={props}>
            <RouterContext {...props} />
          </RouteContext.Provider>
        );
      }}
    >
      <Route path="/" component={component} />
    </Router>
  );
}

describe('ExploreToolbar', function () {
  beforeEach(function () {
    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();
  });

  it('allows changing results mode', async function () {
    let resultMode, sampleFields, groupBys;

    function Component() {
      [resultMode] = useResultMode();
      [sampleFields] = useSampleFields();
      [groupBys] = useGroupBys();
      return <ExploreToolbar />;
    }

    renderWithRouter(Component);

    const section = screen.getByTestId('section-result-mode');
    const samples = within(section).getByRole('radio', {name: 'Samples'});
    const aggregates = within(section).getByRole('radio', {name: 'Aggregate'});

    expect(samples).toBeChecked();
    expect(aggregates).not.toBeChecked();
    expect(resultMode).toEqual('samples');

    expect(sampleFields).toEqual([
      'project',
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ]); // default

    await userEvent.click(aggregates);
    expect(samples).not.toBeChecked();
    expect(aggregates).toBeChecked();
    expect(resultMode).toEqual('aggregate');

    // Add a group by, and leave one unselected
    const groupBy = screen.getByTestId('section-group-by');
    await userEvent.click(within(groupBy).getByRole('button', {name: 'None'}));
    await userEvent.click(within(groupBy).getByRole('option', {name: 'release'}));
    expect(groupBys).toEqual(['release']);
    await userEvent.click(within(groupBy).getByRole('button', {name: '+Add Group By'}));
    expect(groupBys).toEqual(['release', '']);

    await userEvent.click(samples);
    expect(samples).toBeChecked();
    expect(aggregates).not.toBeChecked();
    expect(resultMode).toEqual('samples');

    expect(sampleFields).toEqual([
      'project',
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
      'release',
    ]);
  });

  it('allows changing visualizes', async function () {
    let visualizes;

    function Component() {
      [visualizes] = useVisualizes();
      return <ExploreToolbar />;
    }
    renderWithRouter(Component);

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([{yAxes: ['count(span.duration)']}]);

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(visualizes).toEqual([{yAxes: ['count(span.self_time)']}]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    expect(visualizes).toEqual([{yAxes: ['avg(span.self_time)']}]);

    // try adding an overlay
    await userEvent.click(within(section).getByRole('button', {name: '+Add Overlay'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(visualizes).toEqual([
      {yAxes: ['avg(span.self_time)', 'count(span.self_time)']},
    ]);

    // try adding a new chart
    await userEvent.click(within(section).getByRole('button', {name: '+Add Chart'}));
    expect(visualizes).toEqual([
      {yAxes: ['avg(span.self_time)', 'count(span.self_time)']},
      {yAxes: ['count(span.duration)']},
    ]);

    // delete first overlay
    await userEvent.click(within(section).getAllByLabelText('Remove')[0]);
    expect(visualizes).toEqual([
      {yAxes: ['count(span.self_time)']},
      {yAxes: ['count(span.duration)']},
    ]);

    // delete second chart
    await userEvent.click(within(section).getAllByLabelText('Remove')[1]);
    expect(visualizes).toEqual([{yAxes: ['count(span.self_time)']}]);

    // only one left so cant be deleted
    expect(within(section).getByLabelText('Remove')).toBeDisabled();
  });

  it('allows changing sort by', async function () {
    let sorts;

    function Component() {
      const [sampleFields] = useSampleFields();
      [sorts] = useSorts({fields: sampleFields});
      return <ExploreToolbar />;
    }
    renderWithRouter(Component);

    const section = screen.getByTestId('section-sort-by');

    // this is the default
    expect(within(section).getByRole('button', {name: 'timestamp'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
    expect(sorts).toEqual([{field: 'timestamp', kind: 'desc'}]);

    // check the default field options
    const fields = [
      'project',
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ];
    await userEvent.click(within(section).getByRole('button', {name: 'timestamp'}));
    const fieldOptions = await within(section).findAllByRole('option');
    expect(fieldOptions).toHaveLength(fields.length);
    fieldOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(fields[i]);
    });

    // try changing the field
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(within(section).getByRole('button', {name: 'span.op'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
    expect(sorts).toEqual([{field: 'span.op', kind: 'desc'}]);

    // check the kind options
    await userEvent.click(within(section).getByRole('button', {name: 'Desc'}));
    const kindOptions = await within(section).findAllByRole('option');
    expect(kindOptions).toHaveLength(2);
    expect(kindOptions[0]).toHaveTextContent('Desc');
    expect(kindOptions[1]).toHaveTextContent('Asc');

    // try changing the kind
    await userEvent.click(within(section).getByRole('option', {name: 'Asc'}));
    expect(within(section).getByRole('button', {name: 'span.op'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Asc'})).toBeInTheDocument();
    expect(sorts).toEqual([{field: 'span.op', kind: 'asc'}]);
  });

  it('allows changing group bys', async function () {
    let groupBys;

    function Component() {
      [groupBys] = useGroupBys();
      return <ExploreToolbar />;
    }
    renderWithRouter(Component);

    const section = screen.getByTestId('section-group-by');

    expect(within(section).getByRole('button', {name: 'None'})).toBeInTheDocument();
    expect(groupBys).toEqual(['']);

    // disabled in the samples mode
    expect(within(section).getByRole('button', {name: 'None'})).toBeDisabled();

    // click the aggregates mode to enable
    await userEvent.click(
      within(screen.getByTestId('section-result-mode')).getByRole('radio', {
        name: 'Aggregate',
      })
    );

    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    const groupByOptions1 = await within(section).findAllByRole('option');
    expect(groupByOptions1.length).toBeGreaterThan(0);

    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(within(section).getByRole('button', {name: 'span.op'})).toBeInTheDocument();
    expect(groupBys).toEqual(['span.op']);

    await userEvent.click(within(section).getByRole('button', {name: '+Add Group By'}));
    expect(groupBys).toEqual(['span.op', '']);

    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    const groupByOptions2 = await within(section).findAllByRole('option');
    expect(groupByOptions2.length).toBeGreaterThan(0);

    await userEvent.click(
      within(section).getByRole('option', {name: 'span.description'})
    );
    expect(
      within(section).getByRole('button', {name: 'span.description'})
    ).toBeInTheDocument();
    expect(groupBys).toEqual(['span.op', 'span.description']);

    await userEvent.click(within(section).getAllByLabelText('Remove')[0]);
    expect(groupBys).toEqual(['span.description']);

    // only one left so cant be deleted
    expect(within(section).getByLabelText('Remove')).toBeDisabled();
  });
});
