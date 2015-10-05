import React from "react/addons";
import Cookies from "js-cookie";
import Api from "app/api";
import CursorPoller from "app/utils/cursorPoller";
import LoadingError from "app/components/loadingError";
import LoadingIndicator from "app/components/loadingIndicator";
import Stream from "app/views/stream";
import StreamGroup from "app/components/stream/group";
import StreamFilters from "app/views/stream/filters";
import StreamSidebar from "app/views/stream/sidebar";
import stubReactComponents from "../../helpers/stubReactComponent";
import stubContext from "../../helpers/stubContext";
import stubRouter from "../../helpers/stubRouter";

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/groups/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/groups/?cursor=1443575731:0:0>; rel="next"; results="true"; cursor="1443575731:0:0';

describe("Stream", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Api, "request");
    stubReactComponents(this.sandbox, [StreamGroup, StreamFilters, StreamSidebar]);

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

    describe("complete handler", function () {
      beforeEach(function () {
        this.stubbedApiRequest.restore();
        this.sandbox.stub(Api, "request", (url, options) => {
          options.complete && options.complete({
            getResponseHeader: () => this.linkHeader
          });
        });

        this.sandbox.stub(CursorPoller.prototype, "setEndpoint");
      });

      it("should reset the poller endpoint and sets cursor URL", function() {
        this.linkHeader = DEFAULT_LINKS_HEADER;

        var wrapper = React.render(this.Element, document.body);
        wrapper.refs.wrapped.fetchData();

        expect(CursorPoller.prototype.setEndpoint
          .calledWith('http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/groups/?cursor=1443575731:0:1'))
          .to.be.true;
      });

      it("should not set the poller if the 'previous' link is missing", function () {
        this.linkHeader =
        '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/groups/?cursor=1443575731:0:0>; rel="next"; results="true"; cursor="1443575731:0:0';

        var wrapper = React.render(this.Element, document.body);
        wrapper.refs.wrapped.fetchData();

        expect(CursorPoller.prototype.setEndpoint.notCalled).to.be.ok;
      });
    }); // complete handler

    it("should cancel any previous, unfinished fetches", function () {
      this.stubbedApiRequest.restore();

      var requestCancel = this.sandbox.stub();
      var requestOptions;
      this.sandbox.stub(Api, "request", function (url, options) {
        requestOptions = options;
        return {
          cancel: requestCancel
        };
      });

      // NOTE: fetchData called once after render automatically
      var stream = React.render(this.Element, document.body).refs.wrapped;

      // 2nd fetch should call cancel
      stream.fetchData();

      expect(requestCancel.calledOnce).to.be.ok;
      expect(stream.lastRequest).to.be.ok;

      // when request "completes", lastRequest is cleared
      requestOptions.complete({
        getResponseHeader: () => DEFAULT_LINKS_HEADER
      });

      expect(stream.lastRequest).to.be.null;
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

