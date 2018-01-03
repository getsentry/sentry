import React from 'react';
import {shallow} from 'enzyme';

import StreamActions from 'app/views/stream/actions';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

describe('StreamActions', function() {
  let sandbox;
  let actions;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
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
