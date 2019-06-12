import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mount} from 'enzyme';
import SearchBar from 'app/views/organizationStream/searchBar';
import TagStore from 'app/stores/tagStore';

describe('SearchBar', function() {
  let options;
  let tagValuePromise;
  let supportedTags;
  let recentSearchMock;

  const clickInput = searchBar => searchBar.find('input[name="query"]').simulate('click');

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    supportedTags = TagStore.getAllTags();

    options = TestStubs.routerContext([
      {organization: {id: '123', access: [], features: []}},
    ]);

    tagValuePromise = Promise.resolve([]);

    recentSearchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('updateAutoCompleteItems()', function() {
    beforeAll(function() {
      jest.useFakeTimers();
    });

    afterAll(function() {
      jest.useRealTimers();
    });

    it('sets state with complete tag', function() {
      const loader = (key, value) => {
        expect(key).toEqual('url');
        expect(value).toEqual('fu');
        return tagValuePromise;
      };
      const props = {
        orgId: 'org-slug',
        query: 'url:"fu"',
        tagValueLoader: loader,
        supportedTags,
        onSearch: jest.fn(),
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      jest.advanceTimersByTime(301);
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
    });

    it('sets state when value has colon', function() {
      const loader = (key, value) => {
        expect(key).toEqual('url');
        expect(value).toEqual('http://example.com');
        return tagValuePromise;
      };

      const props = {
        orgId: 'org-slug',
        projectId: '456',
        query: 'url:"http://example.com"',
        tagValueLoader: loader,
        supportedTags,
        onSearch: jest.fn(),
      };

      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      expect(searchBar.state.searchTerm).toEqual();
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual(
        '"http://example.com"'
      );
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
      jest.advanceTimersByTime(301);
    });

    it('does not request values when tag is `timesSeen`', function() {
      // This should never get called
      const loader = jest.fn(x => x);

      const props = {
        orgId: 'org-slug',
        projectId: '456',
        query: 'timesSeen:',
        tagValueLoader: loader,
        supportedTags,
        onSearch: jest.fn(),
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      jest.advanceTimersByTime(301);
      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe('Recent Searches', function() {
    it('saves search query as a recent search', async function() {
      jest.useFakeTimers();
      const saveRecentSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'POST',
        body: {},
      });
      const loader = (key, value) => {
        expect(key).toEqual('url');
        expect(value).toEqual('fu');
        return tagValuePromise;
      };
      const onSearch = jest.fn();
      const props = {
        orgId: 'org-slug',
        query: 'url:"fu"',
        onSearch,
        tagValueLoader: loader,
        supportedTags,
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      jest.advanceTimersByTime(301);
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);

      jest.useRealTimers();
      searchBar.find('form').simulate('submit');
      expect(onSearch).toHaveBeenCalledWith('url:"fu"');

      await tick();
      searchBar.update();
      expect(saveRecentSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            query: 'url:"fu"',
            type: 0,
          },
        })
      );
    });

    it('queries for recent searches', async function() {
      const props = {
        orgId: 'org-slug',
        query: 'timesSeen:',
        tagValueLoader: () => {},
        savedSearchType: 0,
        displayRecentSearches: true,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mount(<SearchBar {...props} />, options);

      wrapper.find('input').simulate('change', {target: {value: 'is:'}});
      await tick();
      wrapper.update();

      expect(recentSearchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'is:',
            limit: 3,
            type: 0,
          },
        })
      );
    });

    it('cycles through keyboard navigation for selection', async function() {
      const props = {
        orgId: 'org-slug',
        query: 'timesSeen:',
        tagValueLoader: () => {},
        savedSearchType: 0,
        displayRecentSearches: true,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mount(<SearchBar {...props} />, options);

      wrapper.find('input').simulate('change', {target: {value: 'is:'}});
      await tick();
      wrapper.update();

      expect(
        wrapper
          .find('SearchItem')
          .at(0)
          .find('li')
          .prop('className')
      ).toContain('active');

      wrapper.find('input').simulate('keyDown', {key: 'ArrowUp'});

      expect(
        wrapper
          .find('SearchItem')
          .last()
          .find('li')
          .prop('className')
      ).toContain('active');
    });
  });

  describe('Pinned Searches', function() {
    let pinSearch;
    let unpinSearch;
    const {organization, routerContext} = initializeOrg({
      organization: {access: [], features: []},
    });

    beforeEach(function() {
      MockApiClient.clearMockResponses();
      pinSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {},
      });
      unpinSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'GET',
        body: [],
      });
    });

    it('has pin icon', function() {
      const props = {
        orgId: organization.slug,
        query: 'url:"fu"',
        onSearch: jest.fn(),
        tagValueLoader: () => Promise.resolve([]),
        supportedTags,
        organization,
      };
      const searchBar = mount(<SearchBar {...props} />, routerContext);
      expect(searchBar.find('PinIcon')).toHaveLength(1);
    });

    it('pins a search from the searchbar', function() {
      const props = {
        orgId: organization.slug,
        query: 'url:"fu"',
        onSearch: jest.fn(),
        tagValueLoader: () => Promise.resolve([]),
        supportedTags,
        organization,
      };
      const searchBar = mount(<SearchBar {...props} />, routerContext);
      searchBar.find('button[aria-label="Pin this search"]').simulate('click');

      expect(pinSearch).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {
            query: 'url:"fu"',
            type: 0,
          },
        })
      );
    });

    it('unpins a search from the searchbar', function() {
      const props = {
        orgId: organization.slug,
        query: 'url:"fu"',
        onSearch: jest.fn(),
        tagValueLoader: () => Promise.resolve([]),
        supportedTags,
        organization,
        pinnedSearch: {id: '1', query: 'url:"fu"'},
      };
      const searchBar = mount(<SearchBar {...props} />, routerContext);
      searchBar.find('button[aria-label="Unpin this search"]').simulate('click');

      expect(unpinSearch).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'DELETE',
          data: {
            type: 0,
          },
        })
      );
    });
  });
});
