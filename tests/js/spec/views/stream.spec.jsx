import React from 'react';
import TestUtils from 'react-addons-test-utils';
import {shallow} from 'enzyme';
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


const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:0>; rel="next"; results="true"; cursor="1443575731:0:0';

describe('Stream', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request', (url, options) => {
      if (url === 'http://127.0.0.1/api/0/projects/sentry/ludic-science/searches/' && options.method === 'GET') {
        options.success && options.success([{'id': '789', 'query': 'is:unresolved', 'name': 'test'}]);
      }
      options.complete && options.complete();
    });

    stubReactComponents(this.sandbox, [StreamGroup, StreamFilters, StreamSidebar, StreamActions, Sticky]);

    this.projectContext = {
      id: '3559',
      slug: 'foo-project',
      firstEvent: true
    };

    let props = {
      setProjectNavSection: function () {},
      location: {query: {query: 'is:unresolved'}, search: 'query=is:unresolved'},
      params: {orgId: '123', projectId: '456'}
    };

    this.wrapper = shallow(<Stream {...props}/>, {
      context: {
        project: this.projectContext,
        organization: {
          id: '1337',
          slug: 'foo-org'
        },
        team: {id: '2448'}
      }
    });
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
        let stream = this.wrapper.instance();
        stream.state.pageLinks = DEFAULT_LINKS_HEADER;
        stream.state.realtimeActive = true;
        stream.fetchData();

        expect(CursorPoller.prototype.setEndpoint
          .calledWith('http://127.0.0.1:8000/api/0/projects/sentry/ludic-science/issues/?cursor=1443575731:0:1'))
          .to.be.true;
      });

      it('should not enable the poller if realtimeActive is false', function () {
        let stream = this.wrapper.instance();
        stream.state.pageLinks = DEFAULT_LINKS_HEADER;
        stream.state.realtimeActive = false;
        stream.fetchData();

        expect(CursorPoller.prototype.setEndpoint.notCalled).to.be.ok;
      });

      it('should not enable the poller if the \'previous\' link has results', function () {
        let stream = this.wrapper.instance();
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
      let stream = this.wrapper.instance();

      // 2nd fetch should call cancel
      stream.fetchData();
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
      let wrapper = this.wrapper;
      wrapper.setState({loading: true});
      expect(wrapper.find('.loading')).to.be.ok;
    });

    it('displays a loading indicator when data is loading', function() {
      let wrapper = this.wrapper;
      wrapper.setState({dataLoading: true});
      expect(wrapper.find('.loading')).to.be.ok;
    });

    it('displays an error when component has errored', function() {
      let wrapper = this.wrapper;
      wrapper.setState({
        error: true,
        loading: false,
        dataLoading: false,
      });
      expect(wrapper.find(LoadingError).length).to.be.ok;
    });

    it('displays the group list', function() {
      let wrapper = this.wrapper;
      wrapper.setState({
        error: false,
        groupIds: ['1'],
        loading: false,
        dataLoading: false,
      });
      expect(wrapper.find('.group-list').length).to.be.ok;
    });

    it('displays empty with no ids', function() {
      let wrapper = this.wrapper;

      wrapper.setState({
        error: false,
        groupIds: [],
        loading: false,
        dataLoading: false,
      });
      expect(wrapper.find('.empty-stream').length).to.be.ok;
    });

    it('shows "awaiting events" message when no events have been sent', function() {
      let wrapper = this.wrapper;

      this.projectContext.firstEvent = false; // Set false for this test only

      wrapper.setState({
        error: false,
        groupIds: [],
        loading: false,
        dataLoading: false,
      });

      expect(this.wrapper.find('.awaiting-events').length).to.equal(1);

      this.projectContext.firstEvent = true; // Reset for other tests
    });

  });

  describe('componentWillMount()', function() {

    afterEach(function() {
      Cookies.remove('realtimeActive');
    });

    it('reads the realtimeActive state from a cookie', function() {
      Cookies.set('realtimeActive', 'false');

      let stream = this.wrapper.instance();
      expect(stream.getInitialState()).to.have.property('realtimeActive', false);
    });

    it('reads the true realtimeActive state from a cookie', function() {
      Cookies.set('realtimeActive', 'true');

      let stream = this.wrapper.instance();
      expect(stream.getInitialState()).to.have.property('realtimeActive', true);
    });

  });

  describe('onRealtimeChange', function() {

    it('sets the realtimeActive state', function() {
      let stream = this.wrapper.instance();
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

    it('handles query', function() {
      let expected = {
        groupIds: [],
        selectAllActive: false,
        multiSelected: false,
        anySelected: false,
        statsPeriod: '24h',
        realtimeActive: false,
        pageLinks: '',
        loading: false,
        dataLoading: true,
        error: false,
        searchId: null,
        query: 'is:unresolved',
        sort: 'date',
      };
      for (let property in expected) {
        let stream = this.wrapper.instance();
        let actual = stream.getInitialState();

        expect(actual[property]).to.eql(expected[property]);
      }
    });

    it('handles no searchId or query', function() {
      let ContextStubbedStream = stubContext(Stream, {
        project: this.projectContext,
        organization: {
          slug: 'foo-org'
        },
        team: {}
      });

      let Element = (
        <ContextStubbedStream
          setProjectNavSection={function () {}}
          location={{query:{sort: 'freq'}, search: 'sort=freq'}}
          params={{orgId: '123', projectId: '456'}}/>
      );
      let expected = {
        groupIds: [],
        selectAllActive: false,
        multiSelected: false,
        anySelected: false,
        statsPeriod: '24h',
        realtimeActive: false,
        pageLinks: '',
        loading: false,
        dataLoading: true,
        error: false,
        query: '',
        sort: 'freq',
        searchId: null,
      };
      for (let property in expected) {
        let stream = TestUtils.renderIntoDocument(Element).refs.wrapped;
        let actual = stream.getInitialState();

        expect(actual[property]).to.eql(expected[property]);
      }
    });

    it('handles valid searchId in routing params', function() {
      let ContextStubbedStream = stubContext(Stream, {
        project: this.projectContext,
        organization: {
          slug: 'foo-org'
        },
        team: {}
      });

      let Element = (
        <ContextStubbedStream
          setProjectNavSection={function () {}}
          location={{query:{sort: 'freq'}, search: 'sort=freq'}}
          params={{orgId: '123', projectId: '456', searchId: '789'}}/>
      );
      let expected = {
        groupIds: [],
        selectAllActive: false,
        multiSelected: false,
        anySelected: false,
        statsPeriod: '24h',
        realtimeActive: false,
        pageLinks: '',
        loading: false,
        dataLoading: true,
        error: false,
        query: 'is:unresolved',
        sort: 'freq',
        searchId: '789',
      };

      for (let property in expected) {
        let stream = TestUtils.renderIntoDocument(Element).refs.wrapped;
        stream.state.savedSearchList = [
          {id: '789', query: 'is:unresolved', name: 'test'}
        ];
        let actual = stream.getInitialState();
        expect(actual[property]).to.eql(expected[property]);
      }
    });

    it('handles invalid searchId in routing params', function() {
      let ContextStubbedStream = stubContext(Stream, {
        project: this.projectContext,
        organization: {
          slug: 'foo-org'
        },
        team: {}
      });

      let Element = (
        <ContextStubbedStream
          setProjectNavSection={function () {}}
          location={{query:{sort: 'freq'}, search: 'sort=freq'}}
          params={{orgId: '123', projectId: '456', searchId: '799'}}/>
      );
      let expected = {
        groupIds: [],
        selectAllActive: false,
        multiSelected: false,
        anySelected: false,
        statsPeriod: '24h',
        realtimeActive: false,
        pageLinks: '',
        loading: false,
        dataLoading: true,
        error: false,
        query: '',
        sort: 'freq',
        searchId: null,
      };

      let stream = TestUtils.renderIntoDocument(Element).refs.wrapped;
      let actual = stream.getInitialState();
      for (let property in expected) {
        expect(actual[property]).to.eql(expected[property]);
      }
    });

  });

});
