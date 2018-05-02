import React from 'react';
import {shallow} from 'enzyme';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import {ProjectReleases} from 'app/views/projectReleases';
import SearchBar from 'app/views/stream/searchBar';
import Pagination from 'app/components/pagination';

import stubReactComponents from '../../helpers/stubReactComponent';

describe('ProjectReleases', function() {
  let sandbox;
  let props;
  let projectReleases;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    sandbox.stub(Client.prototype, 'request');
    stubReactComponents(sandbox, [SearchBar, Pagination]);
    sandbox.stub(browserHistory, 'push');

    props = {
      setProjectNavSection: function() {},
      params: {orgId: '123', projectId: '456'},
      location: {query: {per_page: 0, query: 'derp'}},
    };
    projectReleases = shallow(<ProjectReleases {...props} />);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('fetchData()', function() {
    it('should call releases endpoint', function() {
      expect(Client.prototype.request.args[0][1]).toEqual(
        expect.objectContaining({
          query: {per_page: 20, query: 'derp'},
        })
      );
    });
  });

  describe('getInitialState()', function() {
    it('should take query state from query string', function() {
      expect(projectReleases.state('query')).toEqual('derp');
    });
  });

  describe('onSearch', function() {
    it('should change query string with new search parameter', function() {
      projectReleases.instance().onSearch('searchquery');

      expect(browserHistory.push.calledOnce).toBeTruthy();
      expect(browserHistory.push.args[0]).toEqual([
        {pathname: '/123/456/releases/', query: {query: 'searchquery'}},
      ]);
    });
  });

  // TODO: figure how to trigger componentWillReceiveProps

  describe('componentWillReceiveProps()', function() {
    it('should update state with latest query pulled from query string', function() {
      let setState = sandbox.stub(projectReleases.instance(), 'setState');

      let newProps = {
        ...props,
        location: {
          search: '?query=newquery',
          query: {query: 'newquery'},
        },
      };
      projectReleases.instance().componentWillReceiveProps(newProps);

      expect(setState.calledOnce).toBeTruthy();
      expect(setState.getCall(0).args[0]).toEqual({
        query: 'newquery',
      });
    });
  });
});
