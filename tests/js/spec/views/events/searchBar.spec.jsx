import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SearchBar from 'app/views/events/searchBar';
import TagStore from 'app/stores/tagStore';

const focusInput = el => el.find('input[name="query"]').simulate('focus');
const selectFirstAutocompleteItem = async el => {
  focusInput(el);

  el.find('SearchListItem[data-test-id="search-autocomplete-item"]')
    .first()
    .simulate('click');
  const input = el.find('input');
  input
    .getDOMNode()
    .setSelectionRange(input.prop('value').length, input.prop('value').length);

  await tick();
  await el.update();
};

const setQuery = async (el, query) => {
  el.find('input')
    .simulate('change', {target: {value: query}})
    .getDOMNode()
    .setSelectionRange(query.length, query.length);

  await tick();
  await el.update();
};

describe('SearchBar', function() {
  let options;
  let tagValuesMock;
  const organization = TestStubs.Organization();
  const props = {
    organization,
    projectIds: [1, 2],
  };

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess([
      {count: 3, key: 'gpu', name: 'Gpu'},
      {count: 3, key: 'mytag', name: 'Mytag'},
      {count: 0, key: 'browser', name: 'Browser'},
    ]);

    options = TestStubs.routerContext();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });

    tagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/gpu/values/',
      body: [{count: 2, name: 'Nvidia 1080ti'}],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('searches and selects an event field value', async function() {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    setQuery(wrapper, 'gpu:');

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );

    await tick();
    await wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('');
    expect(
      wrapper
        .find('SearchDropdown Description')
        .first()
        .text()
    ).toEqual('"Nvidia 1080ti"');

    selectFirstAutocompleteItem(wrapper);
    await wrapper.update();
    expect(wrapper.find('input').prop('value')).toBe('gpu:"Nvidia 1080ti" ');
  });

  it('if `useFormWrapper` is false, pressing enter when there are no dropdown items selected should blur and call `onSearch` callback', async function() {
    const onBlur = jest.fn();
    const onSearch = jest.fn();
    const wrapper = mountWithTheme(
      <SearchBar {...props} useFormWrapper={false} onSearch={onSearch} onBlur={onBlur} />,
      options
    );
    await tick();
    await wrapper.update();

    setQuery(wrapper, 'gpu:');
    await tick();
    await wrapper.update();

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('');
    expect(
      wrapper
        .find('SearchDropdown Description')
        .first()
        .text()
    ).toEqual('"Nvidia 1080ti"');

    wrapper.find('input').simulate('keydown', {key: 'Enter'});

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('does not requery for event field values if query does not change', async function() {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    await wrapper.update();

    setQuery(wrapper, 'gpu:');
    await tick();
    await wrapper.update();

    // Click will fire "updateAutocompleteItems"
    wrapper.find('input').simulate('click');
    await tick();
    wrapper.update();

    expect(tagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('removes highlight when query is empty', async function() {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    await wrapper.update();

    setQuery(wrapper, 'gpu');

    await tick();
    await wrapper.update();

    expect(wrapper.find('Description strong').text()).toBe('gpu');

    // Should have nothing highlighted
    setQuery(wrapper, '');
    await tick();
    await wrapper.update();

    expect(wrapper.find('Description strong')).toHaveLength(0);
  });

  it('ignores negation ("!") at the beginning of search term', async function() {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    await wrapper.update();

    setQuery(wrapper, '!gp');
    await tick();
    await wrapper.update();

    expect(
      wrapper.find('SearchListItem[data-test-id="search-autocomplete-item"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('SearchListItem[data-test-id="search-autocomplete-item"]').text()
    ).toBe('gpu:');
  });

  it('ignores wildcard ("*") at the beginning of tag value query', async function() {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    await wrapper.update();

    setQuery(wrapper, '!gpu:*');
    await tick();
    await wrapper.update();

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );
    selectFirstAutocompleteItem(wrapper);
    expect(wrapper.find('input').prop('value')).toBe('!gpu:"Nvidia 1080ti" ');
  });

  it('stops searching after no values are returned', async function() {
    const emptyTagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/browser/values/',
      body: [],
    });

    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    await wrapper.update();

    // Do 3 searches, the first will find nothing, so no more requests should be made
    setQuery(wrapper, 'browser:Nothing');
    await tick();

    setQuery(wrapper, 'browser:NothingE');
    await tick();

    setQuery(wrapper, 'browser:NothingEls');
    await tick();

    expect(emptyTagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('continues searching after no values if query changes', async function() {
    const emptyTagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/browser/values/',
      body: [],
    });

    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    await wrapper.update();

    setQuery(wrapper, 'browser:Nothing');
    setQuery(wrapper, 'browser:Something');

    expect(emptyTagValuesMock).toHaveBeenCalledTimes(2);
  });
});
