import React from 'react';
import {mount} from 'enzyme';

import SearchBar from 'app/views/stream/searchBar';
import TagStore from 'app/stores/tagStore';

describe('SearchBar', function() {
  let options;
  let tagValuePromise;
  let supportedTags;
  const clickInput = searchBar => searchBar.find('input[name="query"]').simulate('click');

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    supportedTags = TagStore.getAllTags();

    options = {
      context: {organization: {id: '123'}},
    };

    tagValuePromise = Promise.resolve([]);
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('updateAutoCompleteItems()', function() {
    beforeAll(function() {
      jest.useFakeTimers();
    });

    it('sets state with complete tag', function() {
      const loader = (key, value) => {
        expect(key).toEqual('url');
        expect(value).toEqual('fu');
        return tagValuePromise;
      };
      const props = {
        orgId: '123',
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
        orgId: '123',
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
        orgId: '123',
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

  it('saves search query as a recent search', async function() {
    jest.useFakeTimers();
    const saveRecentSearch = MockApiClient.addMockResponse({
      url: '/organizations/123/recent-searches/',
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
      orgId: '123',
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
        query: {
          query: 'url:"fu"',
          type: 0,
        },
      })
    );
  });
});
