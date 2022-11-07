import {mountWithTheme} from 'sentry-test/enzyme';

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

function makeWrapper(eventView, handleCellAction, columnIndex = 0, data = defaultData) {
  return mountWithTheme(
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

  describe('hover menu button', function () {
    const wrapper = makeWrapper(view);

    it('shows no menu by default', function () {
      expect(wrapper.find('MenuButton')).toHaveLength(0);
    });

    it('shows a menu on hover, and hides again', function () {
      wrapper.find('Container').simulate('mouseEnter');
      expect(wrapper.find('MenuButton')).toHaveLength(1);

      wrapper.find('Container').simulate('mouseLeave');
      expect(wrapper.find('MenuButton')).toHaveLength(0);
    });
  });

  describe('opening the menu', function () {
    const wrapper = makeWrapper(view);
    wrapper.find('Container').simulate('mouseEnter');

    it('toggles the menu on click', function () {
      // Button should be rendered.
      expect(wrapper.find('MenuButton')).toHaveLength(1);
      wrapper.find('MenuButton').simulate('click');

      // Menu should show now.
      expect(wrapper.find('Menu')).toHaveLength(1);
    });
  });

  describe('per cell actions', function () {
    let wrapper;
    let handleCellAction;
    beforeEach(function () {
      handleCellAction = jest.fn();
      wrapper = makeWrapper(view, handleCellAction);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
    });

    it('add button appends condition', function () {
      wrapper.find('button[data-test-id="add-to-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('add', 'best-transaction');
    });

    it('exclude button adds condition', function () {
      wrapper.find('button[data-test-id="exclude-from-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('exclude button appends exclusions', function () {
      const excludeView = EventView.fromLocation({
        query: {...location.query, query: '!transaction:nope'},
      });
      wrapper = makeWrapper(excludeView, handleCellAction);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      wrapper.find('button[data-test-id="exclude-from-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('go to summary button goes to transaction summary page', function () {
      wrapper.find('button[data-test-id="transaction-summary"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('transaction', 'best-transaction');
    });

    it('go to release button goes to release health page', function () {
      wrapper = makeWrapper(view, handleCellAction, 3);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="release"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith(
        'release',
        'F2520C43515BD1F0E8A6BD46233324641A370BF6'
      );
    });

    it('greater than button adds condition', function () {
      wrapper = makeWrapper(view, handleCellAction, 2);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="show-values-greater-than"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_greater_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('less than button adds condition', function () {
      wrapper = makeWrapper(view, handleCellAction, 2);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="show-values-less-than"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith(
        'show_less_than',
        '2020-06-09T01:46:25+00:00'
      );
    });

    it('error.handled with null adds condition', function () {
      wrapper = makeWrapper(view, handleCellAction, 7, defaultData);

      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="add-to-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('add', 1);
    });

    it('error.type with array values adds condition', function () {
      wrapper = makeWrapper(view, handleCellAction, 8, defaultData);

      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="add-to-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('add', [
        'ServerException',
        'ClickhouseError',
        'QueryException',
        'QueryException',
      ]);
    });

    it('error.handled with 0 adds condition', function () {
      wrapper = makeWrapper(view, handleCellAction, 7, {
        ...defaultData,
        'error.handled': [0],
      });

      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="add-to-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('add', [0]);
    });

    it('show appropriate actions for string cells', function () {
      wrapper = makeWrapper(view, handleCellAction, 0);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(wrapper.find('button[data-test-id="add-to-filter"]').exists()).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="exclude-from-filter"]').exists()
      ).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="show-values-greater-than"]').exists()
      ).toBeFalsy();
      expect(
        wrapper.find('button[data-test-id="show-values-less-than"]').exists()
      ).toBeFalsy();
    });

    it('show appropriate actions for string cells with null values', function () {
      wrapper = makeWrapper(view, handleCellAction, 4);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(wrapper.find('button[data-test-id="add-to-filter"]').exists()).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="exclude-from-filter"]').exists()
      ).toBeTruthy();
    });

    it('show appropriate actions for number cells', function () {
      wrapper = makeWrapper(view, handleCellAction, 1);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(wrapper.find('button[data-test-id="add-to-filter"]').exists()).toBeFalsy();
      expect(
        wrapper.find('button[data-test-id="exclude-from-filter"]').exists()
      ).toBeFalsy();
      expect(
        wrapper.find('button[data-test-id="show-values-greater-than"]').exists()
      ).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="show-values-less-than"]').exists()
      ).toBeTruthy();
    });

    it('show appropriate actions for date cells', function () {
      wrapper = makeWrapper(view, handleCellAction, 2);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(wrapper.find('button[data-test-id="add-to-filter"]').exists()).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="exclude-from-filter"]').exists()
      ).toBeFalsy();
      expect(
        wrapper.find('button[data-test-id="show-values-greater-than"]').exists()
      ).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="show-values-less-than"]').exists()
      ).toBeTruthy();
    });

    it('show appropriate actions for release cells', function () {
      wrapper = makeWrapper(view, handleCellAction, 3);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(wrapper.find('button[data-test-id="release"]').exists()).toBeTruthy();

      wrapper = makeWrapper(view, handleCellAction, 3, {
        ...defaultData,
        release: null,
      });
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(wrapper.find('button[data-test-id="release"]').exists()).toBeFalsy();
    });

    it('show appropriate actions for measurement cells', function () {
      wrapper = makeWrapper(view, handleCellAction, 5);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(
        wrapper.find('button[data-test-id="show-values-greater-than"]').exists()
      ).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="show-values-less-than"]').exists()
      ).toBeTruthy();
      expect(wrapper.find('button[data-test-id="add-to-filter"]').exists()).toBeFalsy();
      expect(
        wrapper.find('button[data-test-id="exclude-from-filter"]').exists()
      ).toBeFalsy();

      wrapper = makeWrapper(view, handleCellAction, 5, {
        ...defaultData,
        'measurements.fcp': null,
      });
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(
        wrapper.find('button[data-test-id="show-values-greater-than"]').exists()
      ).toBeFalsy();
      expect(
        wrapper.find('button[data-test-id="show-values-less-than"]').exists()
      ).toBeFalsy();
      expect(wrapper.find('button[data-test-id="add-to-filter"]').exists()).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="exclude-from-filter"]').exists()
      ).toBeTruthy();
    });

    it('show appropriate actions for numeric function cells', function () {
      wrapper = makeWrapper(view, handleCellAction, 6);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(
        wrapper.find('button[data-test-id="show-values-greater-than"]').exists()
      ).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="show-values-less-than"]').exists()
      ).toBeTruthy();

      wrapper = makeWrapper(view, handleCellAction, 6, {
        ...defaultData,
        'percentile(measurements.fcp, 0.5)': null,
      });
      wrapper.find('Container').simulate('mouseEnter');
      expect(wrapper.find('MenuButton').exists()).toBeFalsy();
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
