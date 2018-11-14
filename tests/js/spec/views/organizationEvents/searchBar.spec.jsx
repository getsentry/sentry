import React from 'react';
import {mount} from 'enzyme';

import SearchBar from 'app/views/organizationEvents/searchBar';
import TagStore from 'app/stores/tagStore';

describe('SearchBar', function() {
  let options;
  let tagValuesMock;
  let tagKeysMock;
  let supportedTags;
  let organization = TestStubs.Organization();
  const clickInput = searchBar => searchBar.find('input[name="query"]').simulate('click');

  beforeEach(function() {
    jest.useFakeTimers();
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    supportedTags = TagStore.getAllTags();

    options = TestStubs.routerContext();

    tagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/stack.filename/values/',
      body: [{count: 2, value: 'test.jsx'}],
    });
    tagKeysMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{count: 1, tag: 'transaction'}, {count: 2, tag: 'mechanism'}],
    });
  });

  afterEach(function() {
    jest.useRealTimers();
    MockApiClient.clearMockResponses();
  });

  it('sets state with complete tag', function() {
    let props = {
      supportedTags,
      organization,
      projectId: '456',
      query: 'stack.filename:"fu"',
    };
    let searchBar = mount(<SearchBar {...props} />, options);
    clickInput(searchBar);
    jest.advanceTimersByTime(301);
    expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
    expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/stack.filename/values/',
      expect.objectContaining({data: {query: 'fu'}})
    );
  });

  it('sets state when value has colon', function() {
    let props = {
      supportedTags,
      organization,
      projectId: '456',
      query: 'stack.filename:"http://example.com"',
    };

    let searchBar = mount(<SearchBar {...props} />, options);
    clickInput(searchBar);
    expect(searchBar.state.searchTerm).toEqual();
    expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual(
      '"http://example.com"'
    );
    expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
    jest.advanceTimersByTime(301);

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/stack.filename/values/',
      expect.objectContaining({data: {query: 'http://example.com'}})
    );
  });
});
