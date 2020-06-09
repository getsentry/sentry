import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import CellAction from 'app/views/eventsV2/table/cellAction';
import EventView from 'app/utils/discover/eventView';

function makeWrapper(eventView, initial, columnIndex = 0) {
  const data = {
    transaction: 'best-transaction',
    count: 19,
    timestamp: '2020-06-09T01:46:25+00:00',
  };
  return mountWithTheme(
    <CellAction
      organization={initial.organization}
      dataRow={data}
      eventView={eventView}
      column={eventView.getColumns()[columnIndex]}
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
      field: ['transaction', 'count()', 'timestamp'],
      widths: ['123', '456', '789'],
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
  const initial = initializeOrg();

  describe('hover menu button', function() {
    const wrapper = makeWrapper(view, initial);

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
    const wrapper = makeWrapper(view, initial);
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
    beforeEach(function() {
      wrapper = makeWrapper(view, initial);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      browserHistory.push.mockReset();
    });

    it('add button appends condition', function() {
      wrapper.find('button[data-test-id="add-to-filter"]').simulate('click');

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          query: 'event.type:transaction transaction:best-transaction',
        }),
      });
    });

    it('exclude button adds condition', function() {
      wrapper.find('button[data-test-id="exclude-from-filter"]').simulate('click');

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          query: 'event.type:transaction !transaction:best-transaction',
        }),
      });
    });

    it('exclude button appends exclusions', function() {
      const excludeView = EventView.fromLocation({
        query: {...location.query, query: '!transaction:nope'},
      });
      wrapper = makeWrapper(excludeView, initial);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');
      wrapper.find('button[data-test-id="exclude-from-filter"]').simulate('click');

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          query: '!transaction:nope !transaction:best-transaction',
        }),
      });
    });

    it('go to summary button goes to transaction summary page', function() {
      wrapper.find('button[data-test-id="transaction-summary"]').simulate('click');

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/performance/summary/',
        query: expect.objectContaining({
          query: undefined,
          project: ['123'],
          transaction: 'best-transaction',
        }),
      });
    });

    it('greater than button adds condition', function() {
      wrapper = makeWrapper(view, initial, 2);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="show-values-greater-than"]').simulate('click');

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          query: 'event.type:transaction timestamp:>2020-06-09T01:46:25+00:00',
          sort: ['-timestamp'],
        }),
      });
    });

    it('less than button adds condition', function() {
      wrapper = makeWrapper(view, initial, 2);
      // Show button and menu.
      wrapper.find('Container').simulate('mouseEnter');
      wrapper.find('MenuButton').simulate('click');

      wrapper.find('button[data-test-id="show-values-less-than"]').simulate('click');

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          query: 'event.type:transaction timestamp:<2020-06-09T01:46:25+00:00',
          sort: ['timestamp'],
        }),
      });
    });
  });
});
