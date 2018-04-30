import React from 'react';
import {mount, shallow} from 'enzyme';

import StreamActions from 'app/views/stream/actions';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

describe('StreamActions', function() {
  let sandbox;
  let actions;
  let wrapper;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('Bulk', function() {
    describe('Total results > bulk limit', function() {
      beforeAll(function() {
        SelectedGroupStore.records = {};
        SelectedGroupStore.add([1, 2, 3]);
        wrapper = mount(
          <StreamActions
            allResultsVisible={false}
            query=""
            queryCount={1500}
            orgId="1337"
            projectId="1"
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
        let apiMock = MockApiClient.addMockResponse({
          url: '/projects/1337/1/issues/',
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
            allResultsVisible={false}
            query=""
            queryCount={600}
            orgId="1337"
            projectId="1"
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
        let apiMock = MockApiClient.addMockResponse({
          url: '/projects/1337/1/issues/',
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
    beforeEach(function() {
      actions = shallow(
        <StreamActions
          query=""
          orgId="1337"
          projectId="1"
          groupIds={[1, 2, 3]}
          onRealtimeChange={function() {}}
          onSelectStatsPeriod={function() {}}
          realtimeActive={false}
          statsPeriod="24h"
        />
      ).instance();
    });

    describe('for all items', function() {
      it("should invoke the callback with 'undefined' and deselect all", function() {
        sandbox.stub(SelectedGroupStore, 'deselectAll');
        let callback = sandbox.stub();

        actions.state.allInQuerySelected = true;

        actions.actionSelectedGroups(callback);

        expect(callback.withArgs(undefined).calledOnce).toBeTruthy();
        expect(SelectedGroupStore.deselectAll.calledOnce).toBeTruthy();

        // all selected is reset
        expect(actions.state.allInQuerySelected).toBe(false);
      });
    });

    describe('for page-selected items', function() {
      it('should invoke the callback with an array of selected items and deselect all', function() {
        sandbox.stub(SelectedGroupStore, 'deselectAll');
        sandbox.stub(SelectedGroupStore, 'getSelectedIds').returns(new Set([1, 2, 3]));

        actions.state.allInQuerySelected = false;
        let callback = sandbox.stub();
        actions.actionSelectedGroups(callback);

        expect(callback.withArgs([1, 2, 3]).calledOnce).toBeTruthy();
        expect(SelectedGroupStore.deselectAll.calledOnce).toBeTruthy();
      });
    });
  });
});
