import React from 'react';
import {mount} from 'enzyme';

import SearchBar from 'app/views/stream/searchBar';
import TagStore from 'app/stores/tagStore';

describe('SearchBar', function() {
  let sandbox;
  let options;
  let urlTagValuesMock;
<<<<<<< HEAD
  let supportedTags;
  const clickInput = searchBar => searchBar.find('input[name="query"]').simulate('click');
=======
  let environmentTagValuesMock;
  let browserTagValuesMock;
>>>>>>> 4e143b35ed... fix edgecase bugs

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    supportedTags = TagStore.getAllTags();

    sandbox = sinon.sandbox.create();

    options = {
      context: {organization: {id: '123'}},
    };

    urlTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/url/values/',
      body: [],
    });
<<<<<<< HEAD
<<<<<<< HEAD
=======
=======

    MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/tag/values/',
      body: [
        {key: 'tag', value: 'foo', name: 'foo'},
        {key: 'tag', value: 'bar', name: 'bar'},
      ],
    });

>>>>>>> 0c8349f5b8... wip
    environmentTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/environment/values/',
      body: [],
    });

    browserTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/browser/values/',
      body: [
        {key: 'browser', value: 'Chrome 70', name: 'Chrome 70'},
        {key: 'browser', value: 'Chrome 71', name: 'Chrome 71'},
      ],
    });
>>>>>>> 4e143b35ed... fix edgecase bugs
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
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"fu"',
        supportedTags,
      };
      let searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      clock.tick(301);
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
      expect(urlTagValuesMock).toHaveBeenCalledWith(
        '/projects/123/456/tags/url/values/',
        expect.objectContaining({data: {query: 'fu'}})
      );
    });

    it('sets state when value has colon', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"http://example.com"',
        supportedTags,
      };

      let searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      expect(searchBar.state.searchTerm).toEqual();
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual(
        '"http://example.com"'
      );
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
      clock.tick(301);

      expect(urlTagValuesMock).toHaveBeenCalledWith(
        '/projects/123/456/tags/url/values/',
        expect.objectContaining({data: {query: 'http://example.com'}})
      );
    });

    it('does not request values when tag is `timesSeen`', function() {
      // This should never get called
      let mock = MockApiClient.addMockResponse({
        url: '/projects/123/456/tags/timesSeen/values/',
        body: [],
      });
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'timesSeen:',
        supportedTags,
      };
      let searchBar = mount(<SearchBar {...props} />, options);
      clickInput(searchBar);
      clock.tick(301);
      expect(mock).not.toHaveBeenCalled();
    });
  });

  describe('onAutoComplete', function() {
    let wrapper;
    let props = {
      orgId: '123',
      projectId: '456',
    };

    const selectFirstAutocompleteItem = el => {
      el.instance().updateAutoCompleteItems();
      el.find('input').simulate('focus');

      el
        .find('.search-autocomplete-item')
        .first()
        .simulate('click');

      const input = el.find('input');

      input
        .getDOMNode()
        .setSelectionRange(input.prop('value').length, input.prop('value').length);

      return el;
    };

    const setQuery = (el, query) => {
      el
        .find('input')
        .simulate('change', {target: {value: query}})
        .getDOMNode()
        .setSelectionRange(query.length, query.length);
    };

    beforeEach(function() {
      wrapper = mount(<SearchBar {...props} />, options);
    });

    it('adds additional autocomplete terms when last query term is a single character and has trailing space', function() {
      setQuery(wrapper, 'timesSeen:1 ');
      selectFirstAutocompleteItem(wrapper);
      expect(wrapper.find('input').prop('value')).toBe('timesSeen:1 browser:');
    });

    it('adds additional autocomplete term with existing term', async function() {
      setQuery(wrapper, 'timesSeen:1 bro');
      selectFirstAutocompleteItem(wrapper);
      expect(wrapper.find('input').prop('value')).toBe('timesSeen:1 browser:');

      selectFirstAutocompleteItem(wrapper);
      expect(browserTagValuesMock).toHaveBeenCalled();
      expect(wrapper.find('input').prop('value')).toBe(
        'timesSeen:1 browser:"Chrome 70" '
      );
    });

    it('adds additional autocomplete terms when last query term is multiple characters and has trailing space', function() {
      setQuery(wrapper, 'timesSeen:1234 ');
      selectFirstAutocompleteItem(wrapper);
      expect(wrapper.find('input').prop('value')).toBe('timesSeen:1234 browser:');
    });

    // This is an existing bug
    it('does not modify query if previous tag value begins with a quote and has trailing space', function() {
      setQuery(wrapper, 'browser:"Chrome ');
      selectFirstAutocompleteItem(wrapper);
      expect(wrapper.find('input').prop('value')).toBe('browser:"Chrome 70" ');
    });

    it('adds autocomplete terms if previous value is a valid quoted value', function() {
      setQuery(wrapper, 'browser:"Chrome 70" ');
      selectFirstAutocompleteItem(wrapper);
      expect(wrapper.find('input').prop('value')).toBe('browser:"Chrome 70" browser:');
    });

    it('does not add anything if autocomplete value is empty string', function() {
      setQuery(wrapper, 'browser:"Chrome 70" ');
      wrapper.instance().onAutoComplete('');
      expect(wrapper.find('input').prop('value')).toBe('browser:"Chrome 70" ');
    });

    it('replaces existing tag value (with quoted value)', function() {
      setQuery(wrapper, 'browser:"Chrome 71" ');
      wrapper
        .find('input')
        .getDOMNode()
        .setSelectionRange(8, 8);
      selectFirstAutocompleteItem(wrapper);
      expect(wrapper.find('input').prop('value')).toBe('browser:"Chrome 70" ');
    });

    it('replaces existing tag value (without quoted value)', function() {
      setQuery(wrapper, 'tag:test1 tag:test2 ');
      wrapper
        .find('input')
        .getDOMNode()
        .setSelectionRange(14, 14);
      selectFirstAutocompleteItem(wrapper);
      expect(wrapper.find('input').prop('value')).toBe('tag:test1 tag:foo');
    });
  });
});
