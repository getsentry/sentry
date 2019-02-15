import React from 'react';
import {mount} from 'enzyme';

import SearchBar from 'app/views/stream/searchBar';
import TagStore from 'app/stores/tagStore';

describe('SearchBar', function() {
  let sandbox;
  let options;
  let tagValuePromise;
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

    tagValuePromise = new Promise(function(resolve, reject) {
      return resolve([]);
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
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      clock.tick(301);
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
      };

      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      expect(searchBar.state.searchTerm).toEqual();
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual(
        '"http://example.com"'
      );
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
      clock.tick(301);
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
      };
      const searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      clock.tick(301);
      expect(loader).not.toHaveBeenCalled();
    });
  });
});
