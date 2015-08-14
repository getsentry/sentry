/*jshint expr: true*/
var React = require("react/addons");
var Cookies = require("js-cookie");

var Api = require("app/api");
var CursorPoller = require("app/utils/cursorPoller");
var LoadingError = require("app/components/loadingError");
var LoadingIndicator = require("app/components/loadingIndicator");
var Stream = require("app/views/stream");
var StreamGroup = require("app/components/streamGroup");
var stubReactComponents = require("../../helpers/stubReactComponent");
var stubContext = require("../../helpers/stubContext");
var stubRouter = require("../../helpers/stubRouter");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

describe("Stream", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Api, "request");
    stubReactComponents(this.sandbox, [StreamGroup]);

    var ContextStubbedStream = stubContext(Stream, {
      router: stubRouter({
        getCurrentParams() {
          return {
            orgId: "123",
            projectId: "456"
          };
        },
        getCurrentQuery() {
          return { limit: 0 };
        }
      })
    });


    this.Element = <ContextStubbedStream setProjectNavSection={function () {}}/>;
  });

  afterEach(function() {
    this.sandbox.restore();
    React.unmountComponentAtNode(document.body);
  });

  describe("fetchData()", function() {

    it("resets the poller endpoint", function() {
      var expectedUrl;
      this.stubbedApiRequest.restore();
      this.sandbox.stub(Api, "request", function(url, options) {
        expectedUrl = url;
        options.complete();
      });

      var stubbedSetEndpoint = this.sandbox.stub(CursorPoller.prototype, "setEndpoint");

      var wrapper = React.render(this.Element, document.body);
      wrapper.refs.wrapped.fetchData();

      expect(stubbedSetEndpoint.calledWith(expectedUrl)).to.be.true;
    });

  });

  describe("render()", function() {

    it("displays a loading indicator when component is loading", function() {
      var wrapper = React.render(this.Element, document.body);
      wrapper.refs.wrapped.setState({ loading: true });
      var expected = findWithType(wrapper, LoadingIndicator);
      expect(expected).to.be.ok;
    });

    it("displays an error when component has errored", function() {
      var wrapper = React.render(this.Element, document.body);
      wrapper.refs.wrapped.setState({
        error: true,
        loading: false
      });
      var expected = findWithType(wrapper, LoadingError);
      expect(expected).to.be.ok;
    });

    it("displays the group list", function() {
      var wrapper = React.render(this.Element, document.body);
      wrapper.refs.wrapped.setState({
        error: false,
        groupIds: ["1"],
        loading: false
      });
      var expected = findWithClass(wrapper, "group-list");
      expect(expected).to.be.ok;
    });

    it("displays empty with no ids", function() {
      var wrapper = React.render(this.Element, document.body);
      wrapper.refs.wrapped.setState({
        error: false,
        groupIds: [],
        loading: false
      });
      var expected = findWithClass(wrapper, "empty-stream");
      expect(expected).to.be.ok;
    });

  });

  describe("componentWillMount()", function() {

    afterEach(function() {
      Cookies.remove("realtimeActive");
    });

    it("reads the realtimeActive state from a cookie", function() {
      Cookies.set("realtimeActive", "false");
      var wrapper = React.render(this.Element, document.body);
      var expected = findWithClass(wrapper, "icon-play");
      expect(expected).to.be.ok;
    });

    it("reads the true realtimeActive state from a cookie", function() {
      Cookies.set("realtimeActive", "true");
      var wrapper = React.render(this.Element, document.body);
      var expected = findWithClass(wrapper, "icon-pause");
      expect(expected).to.be.ok;
    });

  });

  describe("onRealtimeChange", function() {

    it("sets the realtimeActive state", function() {
      var wrapper = React.render(this.Element, document.body);
      wrapper.refs.wrapped.state.realtimeActive = false;
      wrapper.refs.wrapped.onRealtimeChange(true);
      expect(wrapper.refs.wrapped.state.realtimeActive).to.eql(true);
      expect(Cookies.get("realtimeActive")).to.eql("true");

      wrapper.refs.wrapped.onRealtimeChange(false);
      expect(wrapper.refs.wrapped.state.realtimeActive).to.eql(false);
      expect(Cookies.get("realtimeActive")).to.eql("false");
    });

  });

  describe("getInitialState", function() {

    it("sets the right defaults", function() {
      var expected = {
        groupIds: [],
        selectAllActive: false,
        multiSelected: false,
        anySelected: false,
        statsPeriod: '24h',
        realtimeActive: false,
        pageLinks: '',
        loading: true,
        error: false
      };
      var wrapper = React.render(this.Element, document.body);
      var actual = wrapper.refs.wrapped.getInitialState();

      for (var property in expected) {
        expect(actual[property]).to.eql(expected[property]);
      }
    });

  });

});
