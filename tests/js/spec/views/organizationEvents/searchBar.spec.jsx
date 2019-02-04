import React from 'react';
import {mount} from 'enzyme';

import SearchBar from 'app/views/organizationEvents/searchBar';
import TagStore from 'app/stores/tagStore';

const focusInput = el => el.find('input[name="query"]').simulate('focus');
const selectFirstAutocompleteItem = el => {
  focusInput(el);

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

describe('SearchBar', function() {
  let options;
  let tagValuesMock;
  let tagKeysMock;
  const organization = TestStubs.Organization();
  const props = {
    organization,
  };

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());

    options = TestStubs.routerContext();

    tagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/gpu/values/',
      body: [{count: 2, name: 'Nvidia 1080ti'}],
    });
    tagKeysMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{count: 3, key: 'gpu'}, {count: 3, key: 'mytag'}],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('fetches organization tags on mount', async function() {
    const wrapper = await mount(<SearchBar {...props} />, options);
    expect(tagKeysMock).toHaveBeenCalledTimes(1);
    wrapper.update();
    expect(wrapper.find('SmartSearchBar').prop('supportedTags')).toEqual(
      expect.objectContaining({
        gpu: {key: 'gpu', name: 'gpu'},
        mytag: {key: 'mytag', name: 'mytag'},
      })
    );
  });

  it('searches and selects an event field value', async function() {
    const wrapper = await mount(<SearchBar {...props} />, options);
    setQuery(wrapper, 'gpu:');

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({data: {query: ''}})
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('');
    expect(wrapper.find('SearchDropdown').prop('items')).toEqual([
      expect.objectContaining({
        value: '"Nvidia 1080ti"',
      }),
    ]);

    selectFirstAutocompleteItem(wrapper);
    wrapper.update();
    expect(wrapper.find('input').prop('value')).toBe('gpu:"Nvidia 1080ti" ');
  });

  it('does not requery for event field values if query does not change', async function() {
    const wrapper = await mount(<SearchBar {...props} />, options);
    setQuery(wrapper, 'gpu:');

    expect(tagValuesMock).toHaveBeenCalledTimes(1);

    // Click will fire "updateAutocompleteItems"
    wrapper.find('input').simulate('click');

    await tick();
    wrapper.update();
    expect(tagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('removes highlight when query is empty', async function() {
    const wrapper = await mount(<SearchBar {...props} />, options);
    setQuery(wrapper, 'gpu');

    await tick();
    wrapper.update();

    expect(wrapper.find('.search-description strong').text()).toBe('gpu');

    // Should have nothing highlighted
    setQuery(wrapper, '');
    expect(wrapper.find('.search-description strong')).toHaveLength(0);
  });

  it('ignores negation ("!") at the beginning of search term', async function() {
    const wrapper = await mount(<SearchBar {...props} />, options);

    setQuery(wrapper, '!gp');
    await tick();
    wrapper.update();

    expect(wrapper.find('.search-autocomplete-item')).toHaveLength(1);
    expect(wrapper.find('.search-autocomplete-item').text()).toBe('gpu:');
  });

  it('ignores wildcard ("*") at the beginning of tag value query', async function() {
    const wrapper = await mount(<SearchBar {...props} />, options);

    setQuery(wrapper, '!gpu:*');
    await tick();
    wrapper.update();

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({data: {query: ''}})
    );
    selectFirstAutocompleteItem(wrapper);
    expect(wrapper.find('input').prop('value')).toBe('!gpu:*"Nvidia 1080ti" ');
  });
});
