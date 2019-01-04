import React from 'react';
import {shallow, mount} from 'enzyme';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import {ProjectReleases} from 'app/views/releases/list/projectReleases';

describe('ProjectReleases', function() {
  let sandbox;
  let props;
  let projectReleases;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    sandbox.stub(Client.prototype, 'request');

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

      expect(browserHistory.push).toHaveBeenCalledTimes(1);
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/123/456/releases/',
        query: {query: 'searchquery'},
      });
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

  describe('loads landing cards', function() {
    it('should take query state from query string', function() {
      const org = TestStubs.Organization({
        id: '4',
      });
      const project = TestStubs.Project({latestRelease: null});
      const routerContext = TestStubs.routerContext([{organization: org, project}]);

      props = {
        setProjectNavSection: function() {},
        params: {orgId: '123', projectId: '456'},
        location: {query: {per_page: 0, query: ''}},
      };

      let wrapper = mount(<ProjectReleases {...props} />, routerContext);

      wrapper.setState({
        loading: false,
        environment: null,
      });
      wrapper.update();
      expect(wrapper.find('ReleaseLanding')).toHaveLength(1);
      expect(wrapper.find('ReleaseProgress')).toHaveLength(0);
      expect(wrapper.find('Contributors')).toHaveLength(1);
    });
  });

  describe('loads progress bar', function() {
    it('should take query state from query string', function() {
      const org = TestStubs.Organization({
        id: '4',
      });
      const project = TestStubs.Project({latestRelease: null});
      const routerContext = TestStubs.routerContext([{organization: org, project}]);

      props = {
        setProjectNavSection: function() {},
        params: {orgId: '123', projectId: '456'},
        location: {query: {per_page: 0, query: ''}},
      };

      let wrapper = mount(<ProjectReleases {...props} />, routerContext);
      wrapper.setState({
        loading: false,
        environment: null,
        releaseList: [{dateCreated: new Date('2017-10-17'), version: 'blah-blah-blah'}],
      });
      wrapper.update();
      expect(wrapper.find('ReleaseLanding')).toHaveLength(0);
      expect(wrapper.find('ReleaseProgress')).toHaveLength(1);
    });
  });
});
