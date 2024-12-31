import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';

const defaultData: TableDataRow = {
  transaction: 'best-transaction',
  count: 19,
  timestamp: '2020-06-09T01:46:25+00:00',
  release: 'F2520C43515BD1F0E8A6BD46233324641A370BF6',
  'measurements.fcp': 1234,
  'percentile(measurements.fcp, 0.5)': 1234,
  // TODO: Fix this type
  // @ts-ignore
  'error.handled': [null],
  // TODO: Fix this type
  // @ts-ignore
  'error.type': [
    'ServerException',
    'ClickhouseError',
    'QueryException',
    'QueryException',
  ],
  id: '42',
};

function renderComponent({
  eventView,
  handleCellAction = jest.fn(),
  columnIndex = 0,
  data = defaultData,
}: {
  eventView: EventView;
  columnIndex?: number;
  data?: TableDataRow;
  handleCellAction?: (
    action: Actions,
    value: React.ReactText | null[] | string[] | null
  ) => void;
}) {
  return render(
    <CellAction
      dataRow={data}
      column={eventView.getColumns()[columnIndex]!}
      handleCellAction={handleCellAction}
    >
      <strong>some content</strong>
    </CellAction>
  );
}

describe('Discover -> CellAction', function () {
  const location: Location = LocationFixture({
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
      project: ['123'],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'p95',
    },
  });

  const view = EventView.fromLocation(location);

  async function openMenu() {
    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
  }

  describe('hover menu button', function () {
    it('shows no menu by default', function () {
      renderComponent({eventView: view});
      expect(screen.getByRole('button', {name: 'Actions'})).toBeInTheDocument();
    });
  });

  describe('opening the menu', function () {
    it('toggles the menu on click', async function () {
      renderComponent({eventView: view});
      await openMenu();
      expect(
        screen.getByRole('menuitemradio', {name: 'Add to filter'})
      ).toBeInTheDocument();
    });
  });

  describe('per cell actions', function () {
    let handleCellAction!: jest.Mock;

    beforeEach(function () {
      handleCellAction = jest.fn();
    });

    it('add button appends condition', async function () {
      renderComponent({eventView: view, handleCellAction});
      await openMenu();
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', 'best-transaction');
    });

    it('exclude button adds condition', async function () {
      renderComponent({eventView: view, handleCellAction});
      await openMenu();
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
      );

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('exclude button appends exclusions', async function () {
      const excludeView = EventView.fromLocation(
        LocationFixture({
          query: {...location.query, query: '!transaction:nope'},
        })
      );
      renderComponent({eventView: excludeView, handleCellAction});
      await openMenu();
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
      );

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('go to release button goes to release health page', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 3});
      await openMenu();
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Go to release'}));

      expect(handleCellAction).toHaveBeenCalledWith(
        'release',
        'F2520C43515BD1F0E8A6BD46233324641A370BF6'
      );
    });

    it('greater than button adds condition', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 2});
      await openMenu();
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Show values greater than'})
      );

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_greater_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('less than button adds condition', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 2});
      await openMenu();
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Show values less than'})
      );

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_less_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('error.handled with null adds condition', async function () {
      renderComponent({
        eventView: view,
        handleCellAction,
        columnIndex: 7,
        data: defaultData,
      });
      await openMenu();
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', 1);
    });

    it('error.type with array values adds condition', async function () {
      renderComponent({
        eventView: view,
        handleCellAction,
        columnIndex: 8,
        data: defaultData,
      });
      await openMenu();
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', [
        'ServerException',
        'ClickhouseError',
        'QueryException',
        'QueryException',
      ]);
    });

    it('error.handled with 0 adds condition', async function () {
      renderComponent({
        eventView: view,
        handleCellAction,
        columnIndex: 7,
        data: {
          ...defaultData,
          // TODO: Fix this type
          // @ts-ignore
          'error.handled': ['0'],
        },
      });
      await openMenu();
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

      expect(handleCellAction).toHaveBeenCalledWith('add', ['0']);
    });

    it('show appropriate actions for string cells', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 0});
      await openMenu();

      expect(
        screen.getByRole('menuitemradio', {name: 'Add to filter'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Show values greater than'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Show values less than'})
      ).not.toBeInTheDocument();
    });

    it('show appropriate actions for string cells with null values', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 4});
      await openMenu();

      expect(
        screen.getByRole('menuitemradio', {name: 'Add to filter'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for number cells', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 1});
      await openMenu();

      expect(
        screen.queryByRole('menuitemradio', {name: 'Add to filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Exclude from filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for date cells', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 2});
      await openMenu();

      expect(
        screen.getByRole('menuitemradio', {name: 'Add to filter'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Exclude from filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for release cells', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 3});
      await openMenu();

      expect(
        screen.getByRole('menuitemradio', {name: 'Go to release'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for empty release cells', async function () {
      renderComponent({
        eventView: view,
        handleCellAction,
        columnIndex: 3,
        // TODO: Fix this type
        // @ts-ignore
        data: {...defaultData, release: null},
      });
      await openMenu();

      expect(
        screen.queryByRole('menuitemradio', {name: 'Go to release'})
      ).not.toBeInTheDocument();
    });

    it('show appropriate actions for measurement cells', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 5});
      await openMenu();

      expect(
        screen.queryByRole('menuitemradio', {name: 'Add to filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Exclude from filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for empty measurement cells', async function () {
      renderComponent({
        eventView: view,
        handleCellAction,
        columnIndex: 5,
        data: {
          ...defaultData,
          // TODO: Fix this type
          // @ts-ignore
          'measurements.fcp': null,
        },
      });
      await openMenu();

      expect(
        screen.getByRole('menuitemradio', {name: 'Add to filter'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Show values greater than'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Show values less than'})
      ).not.toBeInTheDocument();
    });

    it('show appropriate actions for numeric function cells', async function () {
      renderComponent({eventView: view, handleCellAction, columnIndex: 6});
      await openMenu();

      expect(
        screen.getByRole('menuitemradio', {name: 'Show values greater than'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Show values less than'})
      ).toBeInTheDocument();
    });

    it('show appropriate actions for empty numeric function cells', function () {
      renderComponent({
        eventView: view,
        handleCellAction,
        columnIndex: 6,
        data: {
          ...defaultData,
          // TODO: Fix this type
          // @ts-ignore
          'percentile(measurements.fcp, 0.5)': null,
        },
      });
      expect(screen.queryByRole('button', {name: 'Actions'})).not.toBeInTheDocument();
    });
  });
});

describe('updateQuery()', function () {
  const columnA: TableColumn<keyof TableDataRow> = {
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

  const columnB: TableColumn<keyof TableDataRow> = {
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
    // TODO: Fix this type
    // @ts-ignore
    updateQuery(results, Actions.ADD, columnA, null);
    expect(results.formatString()).toEqual('!has:a');
    // TODO: Fix this type
    // @ts-ignore
    updateQuery(results, Actions.EXCLUDE, columnA, null);
    expect(results.formatString()).toEqual('has:a');
    // TODO: Fix this type
    // @ts-ignore
    updateQuery(results, Actions.ADD, columnA, null);
    expect(results.formatString()).toEqual('!has:a');

    results = new MutableSearch([]);
    // TODO: Fix this type
    // @ts-ignore
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
    const columnADuration: TableColumn<keyof TableDataRow> = {
      ...columnA,
      type: 'duration',
    };

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
    updateQuery(results, Actions.RELEASE, columnA, '');
    updateQuery(results, Actions.DRILLDOWN, columnA, '');
  });

  it('errors for unknown actions', function () {
    const results = new MutableSearch([]);
    // TODO: Fix this type
    // @ts-ignore
    expect(() => updateQuery(results, 'unknown', columnA, '')).toThrow();
  });
});
