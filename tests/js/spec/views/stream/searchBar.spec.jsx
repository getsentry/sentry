import React from 'react';
import {mount} from 'enzyme';

import SearchBar from 'app/views/stream/searchBar';
import TagStore from 'app/stores/tagStore';

describe('SearchBar', function() {
  let sandbox;
  let options;
  let projectTagValuesMock;
  let orgTagValuesMock;
  let supportedTags;
  const clickInput = searchBar => searchBar.find('input[name="query"]').simulate('click');

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    supportedTags = TagStore.getAllTags();

    sandbox = sinon.sandbox.create();

    options = {
      context: {organization: {id: '123'}},
    };

    projectTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/url/values/',
      body: [],
    });
    orgTagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/123/tags/url/values/',
      body: [],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    sandbox.restore();
  });

  describe('updateAutoCompleteItems()', function() {
    let clock;

    beforeEach(function() {
      clock = sandbox.useFakeTimers();
    });
    afterEach(function() {
      clock.restore();
    });

    it('sets state with complete tag', function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"fu"',
        supportedTags,
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      clock.tick(301);
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
      expect(projectTagValuesMock).toHaveBeenCalledWith(
        '/projects/123/456/tags/url/values/',
        expect.objectContaining({query: {query: 'fu'}})
      );
    });

    it('sets state when value has colon', function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"http://example.com"',
        supportedTags,
      };

      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      expect(searchBar.state.searchTerm).toEqual();
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual(
        '"http://example.com"'
      );
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
      clock.tick(301);

      expect(projectTagValuesMock).toHaveBeenCalledWith(
        '/projects/123/456/tags/url/values/',
        expect.objectContaining({query: {query: 'http://example.com'}})
      );
      expect(orgTagValuesMock).not.toHaveBeenCalled();
    });

    it('does not request values when tag is `timesSeen`', function() {
      // This should never get called
      const mock = MockApiClient.addMockResponse({
        url: '/projects/123/456/tags/timesSeen/values/',
        body: [],
      });
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'timesSeen:',
        supportedTags,
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      clock.tick(301);
      expect(mock).not.toHaveBeenCalled();
    });

    it('sets state with complete tag when there is no projectid', function() {
      const props = {
        orgId: '123',
        query: 'url:"fu"',
        supportedTags,
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      clock.tick(301);
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);

      expect(projectTagValuesMock).not.toHaveBeenCalled();
      expect(orgTagValuesMock).toHaveBeenCalledWith(
        '/organizations/123/tags/url/values/',
        expect.objectContaining({query: {query: 'fu'}})
      );
    });
  });
});
