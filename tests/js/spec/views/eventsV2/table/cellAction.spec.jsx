import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import CellAction from 'app/views/eventsV2/table/cellAction';
import EventView from 'app/utils/discover/eventView';

function makeWrapper(eventView, handleCellAction, columnIndex = 0) {
  const data = {
    transaction: 'best-transaction',
    count: 19,
    timestamp: '2020-06-09T01:46:25+00:00',
    release: 'F2520C43515BD1F0E8A6BD46233324641A370BF6',
  };
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
describe('Discover -> CellAction', function() {
  const location = {
    query: {
      id: '42',
      name: 'best query',
      field: ['transaction', 'count()', 'timestamp', 'release'],
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

  describe('hover menu button', function() {
    const wrapper = makeWrapper(view);

    it('shows no menu by default', function() {
      expect(wrapper.find('MenuButton')).toHaveLength(0);
    });

    it('shows a menu on hover, and hides again', function() {
      wrapper.find('Container').simulate('mouseEnter');
      expect(wrapper.find('MenuButton')).toHaveLength(1);

      wrapper.find('Container').simulate('mouseLeave');
      expect(wrapper.find('MenuButton')).toHaveLength(0);
    });
  });

  describe('opening the menu', function() {
    const wrapper = makeWrapper(view);
    wrapper.find('Container').simulate('mouseEnter');

    it('toggles the menu on click', function() {
      // Button should be rendered.
      expect(wrapper.find('MenuButton')).toHaveLength(1);
      wrapper.find('MenuButton').simulate('click');

      // Menu should show now.
      expect(wrapper.find('Menu')).toHaveLength(1);
    });
  });

  describe('per cell actions', function() {
    let wrapper;
    let handleCellAction;
    beforeEach(function() {
      handleCellAction = jest.fn();
      wrapper = makeWrapper(view, handleCellAction);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
    });

    it('add button appends condition', function() {
      wrapper.find('button[data-test-id="add-to-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('add', 'best-transaction');
    });

    it('exclude button adds condition', function() {
      wrapper.find('button[data-test-id="exclude-from-filter"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('exclude', 'best-transaction');
    });

    it('exclude button appends exclusions', function() {
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

    it('go to summary button goes to transaction summary page', function() {
      wrapper.find('button[data-test-id="transaction-summary"]').simulate('click');

      expect(handleCellAction).toHaveBeenCalledWith('transaction', 'best-transaction');
    });

    it('go to release button goes to release health page', function() {
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

    it('greater than button adds condition', function() {
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

    it('less than button adds condition', function() {
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

    it('show appropriate actions for string cells', function() {
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

    it('show appropriate actions for number cells', function() {
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

    it('show appropriate actions for date cells', function() {
      wrapper = makeWrapper(view, handleCellAction, 2);
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      expect(wrapper.find('button[data-test-id="add-to-filter"]').exists()).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="exclude-from-filter"]').exists()
      ).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="show-values-greater-than"]').exists()
      ).toBeTruthy();
      expect(
        wrapper.find('button[data-test-id="show-values-less-than"]').exists()
      ).toBeTruthy();
    });
  });
});
