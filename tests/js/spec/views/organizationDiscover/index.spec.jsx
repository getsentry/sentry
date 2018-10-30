import React from 'react';
import PropTypes from 'prop-types';
import {mount} from 'enzyme';

import OrganizationDiscoverContainer from 'app/views/organizationDiscover';

describe('OrganizationDiscoverContainer', function() {
  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('new query', function() {
    let wrapper;
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['discover'],
    });
    beforeEach(async function() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {
          data: [{tags_key: 'tag1', count: 5}, {tags_key: 'tag2', count: 1}],
        },
      });
      wrapper = mount(
        <OrganizationDiscoverContainer location={{query: {}, search: ''}} params={{}} />,
        TestStubs.routerContext([{organization}])
      );
      await tick();
    });

    it('fetches tags', function() {
      const queryBuilder = wrapper.instance().queryBuilder;
      expect(wrapper.state().isLoading).toBe(false);
      expect(queryBuilder.getColumns().some(column => column.name === 'tags[tag1]')).toBe(
        true
      );
      expect(queryBuilder.getColumns().some(column => column.name === 'tags[tag2]')).toBe(
        true
      );
    });
  });

  describe('saved query', function() {
    let wrapper, savedQueryMock, savedQueries;
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['discover'],
    });
    beforeEach(async function() {
      savedQueries = [
        TestStubs.DiscoverSavedQuery({id: '1', name: 'one'}),
        TestStubs.DiscoverSavedQuery({id: '2', name: 'two'}),
      ];

      savedQueryMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        body: savedQueries[0],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/',
        body: savedQueries,
      });

      wrapper = mount(
        <OrganizationDiscoverContainer
          location={{query: {}, search: ''}}
          params={{savedQueryId: 1}}
        />,
        {
          ...TestStubs.routerContext([{organization}, {organization: PropTypes.object}]),
          disableLifecycleMethods: false,
        }
      );
      await tick();
      wrapper.update();
    });

    it('fetches saved query', function() {
      expect(savedQueryMock).toHaveBeenCalled();
    });

    it('navigates to second query', function() {
      const nextQueryMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/2/',
        body: savedQueries[1],
      });

      expect(wrapper.find('SavedQueryListItem')).toHaveLength(2);

      wrapper.setProps({
        params: {savedQueryId: '2'},
      });

      expect(savedQueryMock).toHaveBeenCalledTimes(1);
      expect(nextQueryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('no access', function() {
    it('display coming soon message', async function() {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      const wrapper = mount(
        <OrganizationDiscoverContainer location={{query: {}, search: ''}} params={{}} />,
        TestStubs.routerContext([{organization}])
      );
      expect(wrapper.text()).toBe('something is happening here soon :)');
    });
  });
});
