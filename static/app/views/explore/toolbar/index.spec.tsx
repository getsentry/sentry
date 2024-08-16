import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
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
    let resultMode;

    function Component() {
      [resultMode] = useResultMode();
      return <ExploreToolbar />;
    }

    renderWithRouter(Component);

    const section = screen.getByTestId('section-result-mode');
    const samples = within(section).getByRole('radio', {name: 'Samples'});
    const aggregates = within(section).getByRole('radio', {name: 'Aggregate'});

    expect(samples).toBeChecked();
    expect(aggregates).not.toBeChecked();
    expect(resultMode).toEqual('samples');

    await userEvent.click(aggregates);
    expect(samples).not.toBeChecked();
    expect(aggregates).toBeChecked();
    expect(resultMode).toEqual('aggregate');

    await userEvent.click(samples);
    expect(samples).toBeChecked();
    expect(aggregates).not.toBeChecked();
    expect(resultMode).toEqual('samples');

    // TODO: check other parts of page reflects this
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
    expect(within(section).getByRole('button', {name: 'Descending'})).toBeInTheDocument();
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
    expect(within(section).getByRole('button', {name: 'Descending'})).toBeInTheDocument();
    expect(sorts).toEqual([{field: 'span.op', kind: 'desc'}]);

    // check the kind options
    await userEvent.click(within(section).getByRole('button', {name: 'Descending'}));
    const kindOptions = await within(section).findAllByRole('option');
    expect(kindOptions).toHaveLength(2);
    expect(kindOptions[0]).toHaveTextContent('Descending');
    expect(kindOptions[1]).toHaveTextContent('Ascending');

    // try changing the kind
    await userEvent.click(within(section).getByRole('option', {name: 'Ascending'}));
    expect(within(section).getByRole('button', {name: 'span.op'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Ascending'})).toBeInTheDocument();
    expect(sorts).toEqual([{field: 'span.op', kind: 'asc'}]);
  });
});
