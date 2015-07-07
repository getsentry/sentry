var React = require("react/addons");

var Stream = require("app/views/stream");
var Api = require("app/api");
var LoadingError = require("app/components/loadingError");
var LoadingIndicator = require("app/components/loadingIndicator");
var stubReactComponents = require("../../helpers/stubReactComponent");
var stubRouterContext = require("../../helpers/stubRouterContext");
var StreamGroup = require("app/components/streamGroup");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

describe("Stream", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(Api, "request");
    this.sandbox.stub(Stream.prototype, "fetchData");
    stubReactComponents(this.sandbox, [StreamGroup]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("render()", function() {

    beforeEach(function() {
      var Element = stubRouterContext(Stream, {
        setProjectNavSection() {}
      }, {
        getCurrentParams() {
          return {
            orgId: "123",
            projectId: "456"
          };
        },
        getCurrentQuery() {
          return {
            limit: 0
          };
        }
      });
      this.wrapper = TestUtils.renderIntoDocument(<Element />);
    });

    it("displays a loading indicator when component is loading", function() {
      this.wrapper.refs.stub.setState({ loading: true });
      var expected = findWithType(this.wrapper, LoadingIndicator);
      expect(expected).to.be.ok;
    });

    it("displays an error when component has errored", function() {
      this.wrapper.refs.stub.setState({
        error: true,
        loading: false
      });
      var expected = findWithType(this.wrapper, LoadingError);
      expect(expected).to.be.ok;
    });

    it("displays the group list", function() {
      this.wrapper.refs.stub.setState({
        error: false,
        groupIds: ["1"],
        loading: false
      });
      var expected = findWithClass(this.wrapper, "group-list");
      expect(expected).to.be.ok;
    });

    it("displays empty with no ids", function() {
      this.wrapper.refs.stub.setState({
        error: false,
        groupIds: [],
        loading: false
      });
      var expected = findWithClass(this.wrapper, "empty-stream");
      expect(expected).to.be.ok;
    });

  });

});
