import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'sentry/views/eventsV2/table/cellAction';

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

  function hoverContainer() {
    userEvent.hover(screen.getByText('some content'));
  }

  function unhoverContainer() {
    userEvent.unhover(screen.getByText('some content'));
  }

  function openMenu() {
    hoverContainer();
    userEvent.click(screen.getByRole('button'));
  }

  describe('hover menu button', function () {
    it('shows no menu by default', function () {
      renderComponent(view);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows a menu on hover, and hides again', function () {
      renderComponent(view);

      hoverContainer();
      expect(screen.getByRole('button')).toBeInTheDocument();

      unhoverContainer();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('opening the menu', function () {
    it('toggles the menu on click', function () {
      renderComponent(view);
      openMenu();
      expect(screen.getByRole('button', {name: 'Add to filter'})).toBeInTheDocument();
    });
  });

  describe('per cell actions', function () {
    let handleCellAction;

    beforeEach(function () {
      handleCellAction = jest.fn();
    });

    it('add button appends condition', function () {
      renderComponent(view, handleCellAction);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', 'best-transaction');
    });

    it('exclude button adds condition', function () {
      renderComponent(view, handleCellAction);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('exclude button appends exclusions', function () {
      const excludeView = EventView.fromLocation({
        query: {...location.query, query: '!transaction:nope'},
      });
      renderComponent(excludeView, handleCellAction);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Exclude from filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('go to summary button goes to transaction summary page', function () {
      renderComponent(view, handleCellAction);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Go to summary'}));

      expect(handleCellAction).toHaveBeenCalledWith('transaction', 'best-transaction');
    });

    it('go to release button goes to release health page', function () {
      renderComponent(view, handleCellAction, 3);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Go to release'}));

      expect(handleCellAction).toHaveBeenCalledWith(
        'release',
        'F2520C43515BD1F0E8A6BD46233324641A370BF6'
      );
    });

    it('greater than button adds condition', function () {
      renderComponent(view, handleCellAction, 2);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Show values greater than'}));

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_greater_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('less than button adds condition', function () {
      renderComponent(view, handleCellAction, 2);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Show values less than'}));

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_less_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('error.handled with null adds condition', function () {
      renderComponent(view, handleCellAction, 7, defaultData);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', 1);
    });

    it('error.type with array values adds condition', function () {
      renderComponent(view, handleCellAction, 8, defaultData);
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', [
        'ServerException',
        'ClickhouseError',
        'QueryException',
        'QueryException',
      ]);
    });

    it('error.handled with 0 adds condition', function () {
      renderComponent(view, handleCellAction, 7, {
        ...defaultData,
        'error.handled': [0],
      });
      openMenu();
      userEvent.click(screen.getByRole('button', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', [0]);
    });

    it('show appropriate actions for string cells', function () {
      renderComponent(view, handleCellAction, 0);
      openMenu();

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

    it('show appropriate actions for string cells with null values', function () {
      renderComponent(view, handleCellAction, 4);
      openMenu();

      expect(screen.getByRole('button', {name: 'Add to filter'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Exclude from filter'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for number cells', function () {
      renderComponent(view, handleCellAction, 1);
      openMenu();

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

    it('show appropriate actions for date cells', function () {
      renderComponent(view, handleCellAction, 2);
      openMenu();

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

    it('show appropriate actions for release cells', function () {
      renderComponent(view, handleCellAction, 3);
      openMenu();

      expect(screen.getByRole('button', {name: 'Go to release'})).toBeInTheDocument();
    });

    it('show appropriate actions for empty release cells', function () {
      renderComponent(view, handleCellAction, 3, {...defaultData, release: null});
      openMenu();

      expect(
        screen.queryByRole('button', {name: 'Go to release'})
      ).not.toBeInTheDocument();
    });

    it('show appropriate actions for measurement cells', function () {
      renderComponent(view, handleCellAction, 5);
      openMenu();

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

    it('show appropriate actions for empty measurement cells', function () {
      renderComponent(view, handleCellAction, 5, {
        ...defaultData,
        'measurements.fcp': null,
      });
      openMenu();

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

    it('show appropriate actions for numeric function cells', function () {
      renderComponent(view, handleCellAction, 6);
      openMenu();

      expect(
        screen.getByRole('button', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for empty numeric function cells', function () {
      renderComponent(view, handleCellAction, 6, {
        ...defaultData,
        'percentile(measurements.fcp, 0.5)': null,
      });
      hoverContainer();
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

  it('modifies the query with has/!has', function () {
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

  it('modifies the query with additions', function () {
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

  it('modifies the query with exclusions', function () {
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

  it('modifies the query with a mix of additions and exclusions', function () {
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

  it('modifies the query with greater/less than', function () {
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

  it('modifies the query with greater/less than on duration fields', function () {
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

  it('does not error for special actions', function () {
    const results = new MutableSearch([]);
    updateQuery(results, Actions.TRANSACTION, columnA, '');
    updateQuery(results, Actions.RELEASE, columnA, '');
    updateQuery(results, Actions.DRILLDOWN, columnA, '');
  });

  it('errors for unknown actions', function () {
    const results = new MutableSearch([]);
    expect(() => updateQuery(results, 'unknown', columnA, '')).toThrow();
  });
});
