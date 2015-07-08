var React = require("react/addons");
var Cookies = require("js-cookie");

var Api = require("app/api");
var LoadingError = require("app/components/loadingError");
var LoadingIndicator = require("app/components/loadingIndicator");
var Stream = require("app/views/stream");
var StreamGroup = require("app/components/streamGroup");
var stubReactComponents = require("../../helpers/stubReactComponent");
var stubRouterContext = require("../../helpers/stubRouterContext");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

describe("Stream", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(Api, "request");
    this.sandbox.stub(Stream.prototype, "fetchData");
    stubReactComponents(this.sandbox, [StreamGroup]);

    this.Element = stubRouterContext(Stream, {
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
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("render()", function() {

    beforeEach(function() {
      this.wrapper = TestUtils.renderIntoDocument(<this.Element />);
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

  describe("componentWillMount()", function() {

    afterEach(function() {
      Cookies.remove("realtimeActive");
    });

    it("reads the realtimeActive state from a cookie", function() {
      Cookies.set("realtimeActive", "false");
      this.wrapper = TestUtils.renderIntoDocument(<this.Element />);
      var expected = findWithClass(this.wrapper, "icon-play");
      expect(expected).to.be.ok;
    });

    it("reads the true realtimeActive state from a cookie", function() {
      Cookies.set("realtimeActive", "true");
      this.wrapper = TestUtils.renderIntoDocument(<this.Element />);
      var expected = findWithClass(this.wrapper, "icon-pause");
      expect(expected).to.be.ok;
    });

  });

  describe("onRealtimeChange", function() {

    it("sets the realtimeActive state", function() {
      this.wrapper = TestUtils.renderIntoDocument(<this.Element />);

      this.wrapper.refs.stub.state.realtimeActive = false;
      this.wrapper.refs.stub.onRealtimeChange(true);
      expect(this.wrapper.refs.stub.state.realtimeActive).to.eql(true);
      expect(Cookies.get("realtimeActive")).to.eql("true");

      this.wrapper.refs.stub.onRealtimeChange(false);
      expect(this.wrapper.refs.stub.state.realtimeActive).to.eql(false);
      expect(Cookies.get("realtimeActive")).to.eql("false");
    });

  });

  describe("getInitialState", function() {

    it("sets the right defaults", function() {
      this.wrapper = TestUtils.renderIntoDocument(<this.Element />);

      var expected = {
        groupIds: [],
        selectAllActive: false,
        multiSelected: false,
        anySelected: false,
        statsPeriod: '24h',
        realtimeActive: true,
        pageLinks: '',
        loading: true,
        error: false
      }
      var actual = this.wrapper.refs.stub.getInitialState();

      for (var property in expected) {
        expect(actual[property]).to.eql(expected[property]);
      }
    });

  });

});
