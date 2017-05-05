import React from 'react';
import {shallow} from 'enzyme';

import {browserHistory} from 'react-router';
import stubReactComponents from '../../helpers/stubReactComponent';

import {Client} from 'app/api';
import ProjectReleases from 'app/views/projectReleases';
import SearchBar from 'app/views/stream/searchBar';
import Pagination from 'app/components/pagination';

describe('ProjectReleases', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(Client.prototype, 'request');
    stubReactComponents(this.sandbox, [SearchBar, Pagination]);
    this.sandbox.stub(browserHistory, 'pushState');

    this.props = {
      setProjectNavSection: function() {},
      params: {orgId: '123', projectId: '456'},
      location: {query: {per_page: 0, query: 'derp'}}
    };
    this.projectReleases = shallow(<ProjectReleases {...this.props} />);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('fetchData()', function() {
    it('should call releases endpoint', function() {
      expect(Client.prototype.request.args[0][0]).toEqual(
        '/projects/123/456/releases/?per_page=20&query=derp'
      );
    });
  });

  describe('getInitialState()', function() {
    it('should take query state from query string', function() {
      expect(this.projectReleases.state('query')).toEqual('derp');
    });
  });

  describe('onSearch', function() {
    it('should change query string with new search parameter', function() {
      let projectReleases = this.projectReleases;

      projectReleases.instance().onSearch('searchquery');

      expect(browserHistory.pushState.calledOnce).toBeTruthy;
      expect(browserHistory.pushState.args[0]).toEqual([
        null,
        '/123/456/releases/',
        {query: 'searchquery'}
      ]);
    });
  });

  // TODO: figure how to trigger componentWillReceiveProps

  describe('componentWillReceiveProps()', function() {
    it('should update state with latest query pulled from query string', function() {
      let projectReleases = this.projectReleases.instance();

      let setState = this.sandbox.stub(projectReleases, 'setState');

      let newProps = {
        ...this.props,
        location: {
          search: '?query=newquery',
          query: {query: 'newquery'}
        }
      };
      projectReleases.componentWillReceiveProps(newProps);

      expect(setState.calledOnce).toBeTruthy;
      expect(setState.getCall(0).args[0]).toEqual({
        query: 'newquery'
      });
    });
  });
});
