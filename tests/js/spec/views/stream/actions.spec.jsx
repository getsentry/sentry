import React from 'react';
import TestUtils from 'react-addons-test-utils';

import {Client} from 'app/api';
import stubReactComponents from '../../../helpers/stubReactComponent';
import StreamActions from 'app/views/stream/actions';
import ActionLink from 'app/views/stream/actionLink';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

describe('StreamActions', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');
    stubReactComponents(this.sandbox, [ActionLink, DropdownLink, MenuItem]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('actionSelectedGroups()', function () {
    beforeEach(function() {
      this.actions = TestUtils.renderIntoDocument(
          <StreamActions
            orgId="1337"
            projectId="1"
            groupIds={[1,2,3]}
            onRealtimeChange={function(){}}
            onSelectStatsPeriod={function(){}}
            realtimeActive={false}
            statsPeriod="24h"
            />
          );
    });

    describe('for all items', function () {
      it('should invoke the callback with \'undefined\' and deselect all', function () {
        this.sandbox.stub(SelectedGroupStore, 'deselectAll');
        let callback = this.sandbox.stub();

        this.actions.state.allInQuerySelected = true;

        this.actions.actionSelectedGroups(callback);

        expect(callback.withArgs(undefined).calledOnce).to.be.ok;
        expect(SelectedGroupStore.deselectAll.calledOnce).to.be.ok;

        // all selected is reset
        expect(this.actions.state.allInQuerySelected, false);
      });
    });

    describe('for page-selected items', function () {
      it('should invoke the callback with an array of selected items and deselect all', function () {
        this.sandbox.stub(SelectedGroupStore, 'deselectAll');
        this.sandbox.stub(SelectedGroupStore, 'getSelectedIds').returns(new Set([1,2,3]));

        this.actions.state.allInQuerySelected = false;
        let callback = this.sandbox.stub();
        this.actions.actionSelectedGroups(callback);

        expect(callback.withArgs([1,2,3]).calledOnce).to.be.ok;
        expect(SelectedGroupStore.deselectAll.calledOnce).to.be.ok;
      });
    });
  });
});


