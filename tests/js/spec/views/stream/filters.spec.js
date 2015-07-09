var React = require("react/addons");

var FilterSelectLink = require("app/views/stream/filterSelectLink");
var SearchBar = require("app/views/stream/searchBar");
var StreamFilters = require("app/views/stream/filters");
var stubReactComponents = require("../../../helpers/stubReactComponent");
var stubRouterContext = require("../../../helpers/stubRouterContext");

var TestUtils = React.addons.TestUtils;

describe("StreamFilters", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    stubReactComponents(this.sandbox, [FilterSelectLink, SearchBar]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("transitionTo()", function() {

    it("calls router.transitionTo() with correct params", function(){
      var stubTransitionTo = this.sandbox.spy();
      var Element = stubRouterContext(StreamFilters, {}, {
        getCurrentParams() {
          return {};
        },
        getCurrentQuery() {
          return {};
        },
        transitionTo: stubTransitionTo
      });
      var wrapper = TestUtils.renderIntoDocument(<Element />);

      wrapper.refs.stub.setState({
        filter: {
          bookmarks: "1"
        },
        query: "is:resolved"
      });

      wrapper.refs.stub.transitionTo();
      var expected = {
        bookmarks: "1",
        query: "is:resolved"
      };

      expect(stubTransitionTo.calledWith("stream", {}, expected)).to.be.true;
    });

    it("omits query if equal to the default query", function(){
      var stubTransitionTo = this.sandbox.spy();
      var Element = stubRouterContext(StreamFilters, {
        defaultQuery: {
          query: "is:unresolved"
        }
      }, {
        getCurrentParams() {
          return {};
        },
        getCurrentQuery() {
          return {};
        },
        transitionTo: stubTransitionTo
      });
      var wrapper = TestUtils.renderIntoDocument(<Element />);

      wrapper.refs.stub.transitionTo();
      expect(stubTransitionTo.calledWith("stream", {}, {})).to.be.true;
    });

  });

});
