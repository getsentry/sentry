import React from 'react';
import TestUtils from 'react-addons-test-utils';

import {browserHistory} from 'react-router';
import stubReactComponents from '../../helpers/stubReactComponent';

import {Client} from 'app/api';
import ProjectReleases from 'app/views/projectReleases';
import SearchBar from 'app/views/stream/searchBar';
import Pagination from 'app/components/pagination';

describe('ProjectReleases', function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(Client.prototype, 'request');
    stubReactComponents(this.sandbox, [SearchBar, Pagination]);
    this.sandbox.stub(browserHistory, 'pushState');

    this.props = {
      setProjectNavSection: function () {},
      params: {orgId: '123', projectId: '456'},
      location: {query: {limit: 0, query: 'derp'}}
    };
    this.projectReleases = TestUtils.renderIntoDocument(
      <ProjectReleases {...this.props}/>
    );
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('fetchData()', function () {
    it('should call releases endpoint', function () {
      expect(Client.prototype.request.args[0][0]).to.equal('/projects/123/456/releases/?limit=50&query=derp');
    });
  });

  describe('getInitialState()', function () {
    it('should take query state from query string', function () {
      expect(this.projectReleases.state.query).to.equal('derp');
    });
  });

  describe('onSearch', function () {
    it('should change query string with new search parameter', function () {
      let projectReleases = this.projectReleases;

      projectReleases.onSearch('searchquery');

      expect(browserHistory.pushState.calledOnce).to.be.ok;
      expect(browserHistory.pushState.args[0]).to.eql([
        null,
        '/123/456/releases/',
        {query: 'searchquery'}
      ]);
    });
  });

  // TODO: figure how to trigger componentWillReceiveProps

  describe('componentWillReceiveProps()', function () {
    it('should update state with latest query pulled from query string', function () {
      let projectReleases = this.projectReleases;

      let setState = this.sandbox.stub(projectReleases, 'setState');

      let newProps = {
        ...this.props,
        location: {
          search: '?query=newquery',
          query: {query: 'newquery'}
        }
      };
      projectReleases.componentWillReceiveProps(newProps);

      expect(setState.calledOnce).to.be.ok;
      expect(setState.getCall(0).args[0]).to.eql({
        query: 'newquery'
      });
    });
  });
});

