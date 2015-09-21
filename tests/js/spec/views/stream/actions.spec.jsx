var React = require("react/addons");
var TestUtils = React.addons.TestUtils;

var api = require("app/api");
var stubReactComponents = require("../../../helpers/stubReactComponent");

var StreamActions = require("app/views/stream/actions");
var ActionLink = require("app/views/stream/actionLink");
var DropdownLink = require("app/components/dropdownLink");
var MenuItem = require("app/components/menuItem");

var SelectedGroupStore = require("app/stores/selectedGroupStore");

describe("StreamActions", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(api, "request");
    stubReactComponents(this.sandbox, [ActionLink, DropdownLink, MenuItem]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("actionSelectedGroups()", function () {
    beforeEach(function() {
      this.actions = TestUtils.renderIntoDocument(
          <StreamActions
            orgId="1337"
            projectId="1"
            groupIds={[1,2,3]}
            onRealtimeChange={function(){}}
            onSelectedStatsPeriod={function(){}}
            realtimeActive={false}
            statsPeriod="24h"
            />
          );
    });

    describe("for all items", function () {
      it("should invoke the callback with 'undefined' and deselect all", function () {
        this.sandbox.stub(SelectedGroupStore, 'deselectAll');
        var callback = this.sandbox.stub();

        this.actions.actionSelectedGroups(this.actions.props.actionTypes.ALL, callback);

        expect(callback.withArgs(undefined).calledOnce).to.be.ok;
        expect(SelectedGroupStore.deselectAll.calledOnce).to.be.ok;
      });
    });

    describe("for selected items", function () {
      it("should invoke the callback with an array of selected items and deselect all", function () {
        this.sandbox.stub(SelectedGroupStore, 'deselectAll');
        this.sandbox.stub(SelectedGroupStore, 'getSelectedIds').returns(new Set([1,2,3]));

        var callback = this.sandbox.stub();
        this.actions.actionSelectedGroups(this.actions.props.actionTypes.SELECTED, callback);

        expect(callback.withArgs([1,2,3]).calledOnce).to.be.ok;
        expect(SelectedGroupStore.deselectAll.calledOnce).to.be.ok;
      });
    });
  });
});

