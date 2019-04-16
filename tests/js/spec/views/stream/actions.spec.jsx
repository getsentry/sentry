import React from 'react';
import {mount, shallow} from 'enzyme';

import {StreamActions} from 'app/views/stream/actions';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

describe('StreamActions', function() {
  let actions;
  let wrapper;

  beforeEach(function() {});

  afterEach(function() {});

  describe('Bulk', function() {
    describe('Total results > bulk limit', function() {
      beforeAll(function() {
        SelectedGroupStore.records = {};
        SelectedGroupStore.add([1, 2, 3]);
        wrapper = mount(
          <StreamActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={1500}
            orgId="1337"
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={[1, 2, 3]}
            onRealtimeChange={function() {}}
            onSelectStatsPeriod={function() {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          TestStubs.routerContext()
        );
      });

      it('after checking "Select all" checkbox, displays bulk select message', async function() {
        wrapper.find('ActionsCheckbox Checkbox').simulate('change');
        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('can bulk select', function() {
        wrapper.find('.stream-select-all-notice a').simulate('click');

        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('bulk resolves', async function() {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        wrapper
          .find('ResolveActions ActionLink')
          .first()
          .simulate('click');

        expect(wrapper.find('ModalDialog')).toMatchSnapshot();
        wrapper.find('Button[priority="primary"]').simulate('click');
        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {status: 'resolved'},
          })
        );

        await tick();
        wrapper.update();
      });
    });

    describe('Total results < bulk limit', function() {
      beforeAll(function() {
        SelectedGroupStore.records = {};
        SelectedGroupStore.add([1, 2, 3]);
        wrapper = mount(
          <StreamActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={600}
            orgId="1337"
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={[1, 2, 3]}
            onRealtimeChange={function() {}}
            onSelectStatsPeriod={function() {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          TestStubs.routerContext()
        );
      });

      it('after checking "Select all" checkbox, displays bulk select message', async function() {
        wrapper.find('ActionsCheckbox Checkbox').simulate('change');
        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('can bulk select', function() {
        wrapper.find('.stream-select-all-notice a').simulate('click');

        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('bulk resolves', async function() {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        wrapper
          .find('ResolveActions ActionLink')
          .first()
          .simulate('click');

        expect(wrapper.find('ModalDialog')).toMatchSnapshot();
        wrapper.find('Button[priority="primary"]').simulate('click');
        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {status: 'resolved'},
          })
        );

        await tick();
        wrapper.update();
      });
    });
  });

  describe('actionSelectedGroups()', function() {
    beforeAll(function() {
      jest.spyOn(SelectedGroupStore, 'deselectAll');
    });

    beforeEach(function() {
      SelectedGroupStore.deselectAll.mockReset();
      actions = shallow(
        <StreamActions
          api={new MockApiClient()}
          query=""
          orgId="1337"
          projectId="1"
          selection={{
            projects: [1],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          groupIds={[1, 2, 3]}
          onRealtimeChange={function() {}}
          onSelectStatsPeriod={function() {}}
          realtimeActive={false}
          statsPeriod="24h"
        />
      ).instance();
    });

    afterAll(function() {
      SelectedGroupStore.mockRestore();
    });

    describe('for all items', function() {
      it("should invoke the callback with 'undefined' and deselect all", function() {
        const callback = jest.fn();

        actions.state.allInQuerySelected = true;

        actions.actionSelectedGroups(callback);

        expect(callback).toHaveBeenCalledWith(undefined);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(SelectedGroupStore.deselectAll).toHaveBeenCalledTimes(1);

        // all selected is reset
        expect(actions.state.allInQuerySelected).toBe(false);
      });
    });

    describe('for page-selected items', function() {
      it('should invoke the callback with an array of selected items and deselect all', function() {
        jest
          .spyOn(SelectedGroupStore, 'getSelectedIds')
          .mockImplementation(() => new Set([1, 2, 3]));

        actions.state.allInQuerySelected = false;
        const callback = jest.fn();
        actions.actionSelectedGroups(callback);

        expect(callback).toHaveBeenCalledWith([1, 2, 3]);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(SelectedGroupStore.deselectAll).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('missing projectId prop', function() {
    beforeEach(function() {
      wrapper = mount(
        <StreamActions
          api={new MockApiClient()}
          query=""
          orgId="1337"
          groupIds={[1, 2, 3]}
          selection={{
            projects: [],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          onRealtimeChange={function() {}}
          onSelectStatsPeriod={function() {}}
          realtimeActive={false}
          statsPeriod="24h"
        />,
        TestStubs.routerContext()
      );
    });

    it('should disable resolve picker', function() {
      const resolve = wrapper.find('ResolveActions').first();
      expect(resolve.props().disabled).toBe(true);
      expect(resolve.props().disableDropdown).toBe(true);
    });

    it('should disable merge button', function() {
      const merge = wrapper.find('ActionLink[className~="action-merge"]').first();
      expect(merge.props().disabled).toBe(true);
    });
  });
});
