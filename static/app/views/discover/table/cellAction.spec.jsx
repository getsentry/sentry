import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';

const defaultData = {
  transaction: 'best-transaction',
  count: 19,
  timestamp: '2020-06-09T01:46:25+00:00',
  release: 'F2520C43515BD1F0E8A6BD46233324641A370BF6',
  nullValue: null,
  'measurements.fcp': 1234,
  'percentile(measurements.fcp, 0.5)': 1234,
  'error.handled': [null],
  'error.type': [
    'ServerException',
    'ClickhouseError',
    'QueryException',
    'QueryException',
  ],
};

function renderComponent(
  eventView,
  handleCellAction,
  columnIndex = 0,
  data = defaultData
) {
  return render(
    <CellAction
      dataRow={data}
      eventView={eventView}
      column={eventView.getColumns()[columnIndex]}
      handleCellAction={handleCellAction}
    >
      <strong>some content</strong>
    </CellAction>
  );
}

describe('Discover -> CellAction', function () {
  const location = {
    query: {
      id: '42',
      name: 'best query',
      field: [
        'transaction',
        'count()',
        'timestamp',
        'release',
        'nullValue',
        'measurements.fcp',
        'percentile(measurements.fcp, 0.5)',
        'error.handled',
        'error.type',
      ],
      widths: ['437', '647', '416', '905'],
      sort: ['title'],
      query: 'event.type:transaction',
      project: [123],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'p95',
    },
  };
  const view = EventView.fromLocation(location);

  async function hoverContainer() {
    await userEvent.hover(screen.getByText('some content'));
  }

  async function unhoverContainer() {
    await userEvent.unhover(screen.getByText('some content'));
  }

  async function openMenu() {
    await hoverContainer();
    await userEvent.click(screen.getByRole('button'));
  }

  describe('hover menu button', function () {
    it('shows no menu by default', async function () {
      renderComponent(view);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows a menu on hover, and hides again', async function () {
      renderComponent(view);

      await hoverContainer();
      expect(screen.getByRole('button')).toBeInTheDocument();

      await unhoverContainer();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('opening the menu', function () {
    it('toggles the menu on click', async function () {
      renderComponent(view);
      await openMenu();
      expect(screen.getByRole('button', {name: 'Add to filter'})).toBeInTheDocument();
    });
  });

  describe('per cell actions', function () {
    let handleCellAction;

    beforeEach(function () {
      handleCellAction = jest.fn();
    });

    it('add button appends condition', async function () {
      renderComponent(view, handleCellAction);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', 'best-transaction');
    });

    it('exclude button adds condition', async function () {
      renderComponent(view, handleCellAction);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('exclude button appends exclusions', async function () {
      const excludeView = EventView.fromLocation({
        query: {...location.query, query: '!transaction:nope'},
      });
      renderComponent(excludeView, handleCellAction);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('go to summary button goes to transaction summary page', async function () {
      renderComponent(view, handleCellAction);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Go to summary'}));

      expect(handleCellAction).toHaveBeenCalledWith('transaction', 'best-transaction');
    });

    it('go to release button goes to release health page', async function () {
      renderComponent(view, handleCellAction, 3);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Go to release'}));

      expect(handleCellAction).toHaveBeenCalledWith(
        'release',
        'F2520C43515BD1F0E8A6BD46233324641A370BF6'
      );
    });

    it('greater than button adds condition', async function () {
      renderComponent(view, handleCellAction, 2);
      await openMenu();
      await userEvent.click(
        screen.getByRole('button', {name: 'Show values greater than'})
      );

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_greater_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('less than button adds condition', async function () {
      renderComponent(view, handleCellAction, 2);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Show values less than'}));

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_less_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('error.handled with null adds condition', async function () {
      renderComponent(view, handleCellAction, 7, defaultData);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', 1);
    });

    it('error.type with array values adds condition', async function () {
      renderComponent(view, handleCellAction, 8, defaultData);
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', [
        'ServerException',
        'ClickhouseError',
        'QueryException',
        'QueryException',
      ]);
    });

    it('error.handled with 0 adds condition', async function () {
      renderComponent(view, handleCellAction, 7, {
        ...defaultData,
        'error.handled': [0],
      });
      await openMenu();
      await userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', [0]);
    });

    it('show appropriate actions for string cells', async function () {
      renderComponent(view, handleCellAction, 0);
      await openMenu();

      expect(screen.getByRole('button', {name: 'Add to filter'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Exclude from filter'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Show values greater than'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Show values less than'})
      ).not.toBeInTheDocument();
    });

    it('show appropriate actions for string cells with null values', async function () {
      renderComponent(view, handleCellAction, 4);
      await openMenu();

      expect(screen.getByRole('button', {name: 'Add to filter'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Exclude from filter'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for number cells', async function () {
      renderComponent(view, handleCellAction, 1);
      await openMenu();

      expect(
        screen.queryByRole('button', {name: 'Add to filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Exclude from filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for date cells', async function () {
      renderComponent(view, handleCellAction, 2);
      await openMenu();

      expect(screen.getByRole('button', {name: 'Add to filter'})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Exclude from filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for release cells', async function () {
      renderComponent(view, handleCellAction, 3);
      await openMenu();

      expect(screen.getByRole('button', {name: 'Go to release'})).toBeInTheDocument();
    });

    it('show appropriate actions for empty release cells', async function () {
      renderComponent(view, handleCellAction, 3, {...defaultData, release: null});
      await openMenu();

      expect(
        screen.queryByRole('button', {name: 'Go to release'})
      ).not.toBeInTheDocument();
    });

    it('show appropriate actions for measurement cells', async function () {
      renderComponent(view, handleCellAction, 5);
      await openMenu();

      expect(
        screen.queryByRole('button', {name: 'Add to filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Exclude from filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for empty measurement cells', async function () {
      renderComponent(view, handleCellAction, 5, {
        ...defaultData,
        'measurements.fcp': null,
      });
      await openMenu();

      expect(screen.getByRole('button', {name: 'Add to filter'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Exclude from filter'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Show values greater than'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Show values less than'})
      ).not.toBeInTheDocument();
    });

    it('show appropriate actions for numeric function cells', async function () {
      renderComponent(view, handleCellAction, 6);
      await openMenu();

      expect(
        screen.getByRole('button', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for empty numeric function cells', async function () {
      renderComponent(view, handleCellAction, 6, {
        ...defaultData,
        'percentile(measurements.fcp, 0.5)': null,
      });
      await hoverContainer();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});

describe('updateQuery()', function () {
  const columnA = {
    key: 'a',
    name: 'a',
    type: 'number',
    isSortable: false,
    column: {
      kind: 'field',
      field: 'a',
    },
    width: -1,
  };

  const columnB = {
    key: 'b',
    name: 'b',
    type: 'number',
    isSortable: false,
    column: {
      kind: 'field',
      field: 'b',
    },
    width: -1,
  };

  it('modifies the query with has/!has', async function () {
    let results = new MutableSearch([]);
    updateQuery(results, Actions.ADD, columnA, null);
    expect(results.formatString()).toEqual('!has:a');
    updateQuery(results, Actions.EXCLUDE, columnA, null);
    expect(results.formatString()).toEqual('has:a');
    updateQuery(results, Actions.ADD, columnA, null);
    expect(results.formatString()).toEqual('!has:a');

    results = new MutableSearch([]);
    updateQuery(results, Actions.ADD, columnA, [null]);
    expect(results.formatString()).toEqual('!has:a');
  });

  it('modifies the query with additions', async function () {
    const results = new MutableSearch([]);
    updateQuery(results, Actions.ADD, columnA, '1');
    expect(results.formatString()).toEqual('a:1');
    updateQuery(results, Actions.ADD, columnB, '1');
    expect(results.formatString()).toEqual('a:1 b:1');
    updateQuery(results, Actions.ADD, columnA, '2');
    expect(results.formatString()).toEqual('b:1 a:2');
    updateQuery(results, Actions.ADD, columnA, ['1', '2', '3']);
    expect(results.formatString()).toEqual('b:1 a:2 a:1 a:3');
  });

  it('modifies the query with exclusions', async function () {
    const results = new MutableSearch([]);
    updateQuery(results, Actions.EXCLUDE, columnA, '1');
    expect(results.formatString()).toEqual('!a:1');
    updateQuery(results, Actions.EXCLUDE, columnB, '1');
    expect(results.formatString()).toEqual('!a:1 !b:1');
    updateQuery(results, Actions.EXCLUDE, columnA, '2');
    expect(results.formatString()).toEqual('!b:1 !a:1 !a:2');
    updateQuery(results, Actions.EXCLUDE, columnA, ['1', '2', '3']);
    expect(results.formatString()).toEqual('!b:1 !a:1 !a:2 !a:3');
  });

  it('modifies the query with a mix of additions and exclusions', async function () {
    const results = new MutableSearch([]);
    updateQuery(results, Actions.ADD, columnA, '1');
    expect(results.formatString()).toEqual('a:1');
    updateQuery(results, Actions.ADD, columnB, '2');
    expect(results.formatString()).toEqual('a:1 b:2');
    updateQuery(results, Actions.EXCLUDE, columnA, '3');
    expect(results.formatString()).toEqual('b:2 !a:3');
    updateQuery(results, Actions.EXCLUDE, columnB, '4');
    expect(results.formatString()).toEqual('!a:3 !b:4');
    results.addFilterValues('!a', ['*dontescapeme*'], false);
    expect(results.formatString()).toEqual('!a:3 !b:4 !a:*dontescapeme*');
    updateQuery(results, Actions.EXCLUDE, columnA, '*escapeme*');
    expect(results.formatString()).toEqual(
      '!b:4 !a:3 !a:*dontescapeme* !a:"\\*escapeme\\*"'
    );
    updateQuery(results, Actions.ADD, columnA, '5');
    expect(results.formatString()).toEqual('!b:4 a:5');
    updateQuery(results, Actions.ADD, columnB, '6');
    expect(results.formatString()).toEqual('a:5 b:6');
  });

  it('modifies the query with greater/less than', async function () {
    const results = new MutableSearch([]);
    updateQuery(results, Actions.SHOW_GREATER_THAN, columnA, 1);
    expect(results.formatString()).toEqual('a:>1');
    updateQuery(results, Actions.SHOW_GREATER_THAN, columnA, 2);
    expect(results.formatString()).toEqual('a:>2');
    updateQuery(results, Actions.SHOW_LESS_THAN, columnA, 3);
    expect(results.formatString()).toEqual('a:<3');
    updateQuery(results, Actions.SHOW_LESS_THAN, columnA, 4);
    expect(results.formatString()).toEqual('a:<4');
  });

  it('modifies the query with greater/less than on duration fields', async function () {
    const columnADuration = {...columnA, type: 'duration'};

    const results = new MutableSearch([]);
    updateQuery(results, Actions.SHOW_GREATER_THAN, columnADuration, 1);
    expect(results.formatString()).toEqual('a:>1.00ms');
    updateQuery(results, Actions.SHOW_GREATER_THAN, columnADuration, 2);
    expect(results.formatString()).toEqual('a:>2.00ms');
    updateQuery(results, Actions.SHOW_LESS_THAN, columnADuration, 3);
    expect(results.formatString()).toEqual('a:<3.00ms');
    updateQuery(results, Actions.SHOW_LESS_THAN, columnADuration, 4.1234);
    expect(results.formatString()).toEqual('a:<4.12ms');
  });

  it('does not error for special actions', async function () {
    const results = new MutableSearch([]);
    updateQuery(results, Actions.TRANSACTION, columnA, '');
    updateQuery(results, Actions.RELEASE, columnA, '');
    updateQuery(results, Actions.DRILLDOWN, columnA, '');
  });

  it('errors for unknown actions', async function () {
    const results = new MutableSearch([]);
    expect(() => updateQuery(results, 'unknown', columnA, '')).toThrow();
  });
});
