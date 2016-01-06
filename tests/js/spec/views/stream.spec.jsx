import React from 'react';
import TestUtils from 'react-addons-test-utils';
import Cookies from 'js-cookie';
import Sticky from 'react-sticky';
import {Client} from 'app/api';
import CursorPoller from 'app/utils/cursorPoller';
import LoadingError from 'app/components/loadingError';
import Stream from 'app/views/stream';
import StreamGroup from 'app/components/stream/group';
import StreamFilters from 'app/views/stream/filters';
import StreamSidebar from 'app/views/stream/sidebar';
import StreamActions from 'app/views/stream/actions';
import stubReactComponents from '../../helpers/stubReactComponent';
import stubContext from '../../helpers/stubContext';

const findWithClass = TestUtils.findRenderedDOMComponentWithClass;
const findWithType = TestUtils.findRenderedComponentWithType;

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:0>; rel="next"; results="true"; cursor="1443575731:0:0';

describe('Stream', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request', (url, options) => {
      options.complete && options.complete();
    });

    stubReactComponents(this.sandbox, [StreamGroup, StreamFilters, StreamSidebar, StreamActions, Sticky]);

    this.projectContext = {
      slug: 'foo-project',
      firstEvent: true
    };

    let ContextStubbedStream = stubContext(Stream, {
      project: this.projectContext,
      organization: {
        slug: 'foo-org'
      }
    });

    this.Element = (
      <ContextStubbedStream
        setProjectNavSection={function () {}}
        location={{query:{}}}
        params={{orgId: '123', projectId: '456'}}/>
    );
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('fetchData()', function() {
    describe('complete handler', function () {
      beforeEach(function () {
        this.sandbox.stub(CursorPoller.prototype, 'setEndpoint');
      });

      it('should reset the poller endpoint and sets cursor URL', function() {
        let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
        stream.state.pageLinks = DEFAULT_LINKS_HEADER;
        stream.state.realtimeActive = true;
        stream.fetchData();

        expect(CursorPoller.prototype.setEndpoint
          .calledWith('http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:1'))
          .to.be.true;
      });

      it('should not enable the poller if realtimeActive is false', function () {
        let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
        stream.state.pageLinks = DEFAULT_LINKS_HEADER;
        stream.state.realtimeActive = false;
        stream.fetchData();

        expect(CursorPoller.prototype.setEndpoint.notCalled).to.be.ok;
      });

      it('should not enable the poller if the \'previous\' link has results', function () {
        let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
        stream.state.pageLinks =
          '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:1>; rel="previous"; results="true"; cursor="1443575731:0:1", ' +
          '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:0>; rel="next"; results="true"; cursor="1443575731:0:0';

        stream.state.realtimeActive = true;
        stream.fetchData();

        expect(CursorPoller.prototype.setEndpoint.notCalled).to.be.ok;
      });
    }); // complete handler

    it('should cancel any previous, unfinished fetches', function () {
      this.stubbedApiRequest.restore();

      let requestCancel = this.sandbox.stub();
      let requestOptions;
      this.sandbox.stub(Client.prototype, 'request', function (url, options) {
        requestOptions = options;
        return {
          cancel: requestCancel
        };
      });

      // NOTE: fetchData called once after render automatically
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;

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

  describe('render()', function() {

    it('displays a loading indicator when component is loading', function() {
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
      stream.setState({loading: true});
      let expected = findWithClass(stream, 'loading');

      expect(expected).to.be.ok;
    });

    it('displays an error when component has errored', function() {
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
      stream.setState({
        error: true,
        loading: false
      });
      let expected = findWithType(stream, LoadingError);
      expect(expected).to.be.ok;
    });

    it('displays the group list', function() {
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
      stream.setState({
        error: false,
        groupIds: ['1'],
        loading: false
      });
      let expected = findWithClass(stream, 'group-list');
      expect(expected).to.be.ok;
    });

    it('displays empty with no ids', function() {
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;

      stream.setState({
        error: false,
        groupIds: [],
        loading: false
      });
      let expected = findWithClass(stream, 'empty-stream');
      expect(expected).to.be.ok;
    });

    it('shows "awaiting events" message when no events have been sent', function() {
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;

      this.projectContext.firstEvent = false; // Set false for this test only

      stream.setState({
        error: false,
        groupIds: [],
        loading: false
      });
      let expected = findWithClass(stream, 'awaiting-events');
      expect(expected).to.be.ok;

      this.projectContext.firstEvent = true; // Reset for other tests
    });

  });

  describe('componentWillMount()', function() {

    afterEach(function() {
      Cookies.remove('realtimeActive');
    });

    it('reads the realtimeActive state from a cookie', function(done) {
      Cookies.set('realtimeActive', 'false');

      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
      setTimeout(() => {
        expect(stream.state.realtimeActive).to.not.be.ok;
        done();
      });
    });

    it('reads the true realtimeActive state from a cookie', function(done) {
      Cookies.set('realtimeActive', 'true');
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;

      setTimeout(() => {
        expect(stream.state.realtimeActive).to.be.ok;
        done();
      });
    });

  });

  describe('onRealtimeChange', function() {

    it('sets the realtimeActive state', function() {
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
      stream.state.realtimeActive = false;
      stream.onRealtimeChange(true);
      expect(stream.state.realtimeActive).to.eql(true);
      expect(Cookies.get('realtimeActive')).to.eql('true');

      stream.onRealtimeChange(false);
      expect(stream.state.realtimeActive).to.eql(false);
      expect(Cookies.get('realtimeActive')).to.eql('false');
    });

  });

  describe('getInitialState', function() {

    it('sets the right defaults', function() {
      let expected = {
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
      let stream = TestUtils.renderIntoDocument(this.Element).refs.wrapped;
      let actual = stream.getInitialState();

      for (let property in expected) {
        expect(actual[property]).to.eql(expected[property]);
      }
    });

  });

});
