import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import SearchBar from 'sentry/components/events/searchBar';
import TagStore from 'sentry/stores/tagStore';

const focusTextarea = el => el.find('textarea[name="query"]').simulate('focus');
const selectNthAutocompleteItem = async (el, index) => {
  focusTextarea(el);

  el.find('SearchListItem[data-test-id="search-autocomplete-item"]')
    .at(index)
    .simulate('click');
  const textarea = el.find('textarea');
  textarea
    .getDOMNode()
    .setSelectionRange(textarea.prop('value').length, textarea.prop('value').length);

  await tick();
  await el.update();
};

const setQuery = async (el, query) => {
  el.find('textarea').simulate('focus');
  el.find('textarea')
    .simulate('change', {target: {value: query}})
    .getDOMNode()
    .setSelectionRange(query.length, query.length);

  await tick();
  await el.update();
};

describe('Events > SearchBar', function () {
  let options;
  let tagValuesMock;
  let organization;
  let props;

  beforeEach(function () {
    organization = TestStubs.Organization();
    props = {
      organization,
      projectIds: [1, 2],
    };
    TagStore.reset();
    TagStore.loadTagsSuccess([
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

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('autocompletes measurement names', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['performance-view'],
      },
    });
    props.organization = initializationObj.organization;
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    setQuery(wrapper, 'fcp');

    await tick();
    wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('fcp');
    expect(wrapper.find('SearchDropdown Description').first().text()).toEqual(
      'measurements.fcp:'
    );
  });

  it('autocompletes release semver queries', async function () {
    const initializationObj = initializeOrg();
    props.organization = initializationObj.organization;
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    setQuery(wrapper, 'release.');

    await tick();
    wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('release.');
    expect(wrapper.find('SearchDropdown Description').first().text()).toEqual(
      'release.build:'
    );
  });

  it('autocompletes has suggestions correctly', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    setQuery(wrapper, 'has:');

    await tick();
    wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('');
    expect(wrapper.find('SearchDropdown Description').at(2).text()).toEqual('gpu');

    selectNthAutocompleteItem(wrapper, 2);
    wrapper.update();
    // the trailing space is important here as without it, autocomplete suggestions will
    // try to complete `has:gpu` thinking the token has not ended yet
    expect(wrapper.find('textarea').prop('value')).toBe('has:gpu ');
  });

  it('searches and selects an event field value', async function () {
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
    wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('');
    expect(wrapper.find('SearchDropdown Description').at(2).text()).toEqual(
      '"Nvidia 1080ti"'
    );

    selectNthAutocompleteItem(wrapper, 2);
    wrapper.update();
    expect(wrapper.find('textarea').prop('value')).toBe('gpu:"Nvidia 1080ti" ');
  });

  it('if `useFormWrapper` is false, pressing enter when there are no dropdown items selected should blur and call `onSearch` callback', async function () {
    const onBlur = jest.fn();
    const onSearch = jest.fn();
    const wrapper = mountWithTheme(
      <SearchBar {...props} useFormWrapper={false} onSearch={onSearch} onBlur={onBlur} />,
      options
    );
    await tick();
    wrapper.update();

    setQuery(wrapper, 'gpu:');
    await tick();
    wrapper.update();

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('');
    expect(wrapper.find('SearchDropdown Description').at(2).text()).toEqual(
      '"Nvidia 1080ti"'
    );
    selectNthAutocompleteItem(wrapper, 2);

    wrapper.find('textarea').simulate('keydown', {key: 'Enter'});

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('filters dropdown to accommodate for num characters left in query', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} maxQueryLength={5} />, options);
    await tick();
    wrapper.update();
    wrapper.setState;

    setQuery(wrapper, 'g');
    await tick();
    wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('g');
    expect(wrapper.find('SearchDropdown Description')).toEqual({});
    expect(
      wrapper.find('SearchListItem[data-test-id="search-autocomplete-item"]')
    ).toHaveLength(1);
  });

  it('returns zero dropdown suggestions if out of characters', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} maxQueryLength={2} />, options);
    await tick();
    wrapper.update();
    wrapper.setState;

    setQuery(wrapper, 'g');
    await tick();
    wrapper.update();

    expect(wrapper.find('SearchDropdown').prop('searchSubstring')).toEqual('g');
    expect(wrapper.find('SearchDropdown Description')).toEqual({});
    expect(
      wrapper.find('SearchListItem[data-test-id="search-autocomplete-item"]')
    ).toHaveLength(0);
  });

  it('sets maxLength property', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} maxQueryLength={10} />, options);
    await tick();
    expect(wrapper.find('textarea').prop('maxLength')).toBe(10);
  });

  it('does not requery for event field values if query does not change', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    wrapper.update();

    setQuery(wrapper, 'gpu:');
    await tick();
    wrapper.update();

    // Click will fire "updateAutocompleteItems"
    wrapper.find('textarea').simulate('click');
    await tick();
    wrapper.update();

    expect(tagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('removes highlight when query is empty', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    wrapper.update();

    setQuery(wrapper, 'gpu');

    await tick();
    wrapper.update();

    expect(wrapper.find('Description strong').text()).toBe('gpu');

    // Should have nothing highlighted
    setQuery(wrapper, '');
    await tick();
    wrapper.update();

    expect(wrapper.find('Description strong')).toHaveLength(0);
  });

  it('ignores negation ("!") at the beginning of search term', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    wrapper.update();

    setQuery(wrapper, '!gp');
    await tick();
    wrapper.update();

    expect(
      wrapper.find('SearchListItem[data-test-id="search-autocomplete-item"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('SearchListItem[data-test-id="search-autocomplete-item"]').text()
    ).toBe('gpu:');
  });

  it('ignores wildcard ("*") at the beginning of tag value query', async function () {
    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    wrapper.update();

    setQuery(wrapper, '!gpu:*');
    await tick();
    wrapper.update();

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );
    selectNthAutocompleteItem(wrapper, 0);
    expect(wrapper.find('textarea').prop('value')).toBe('!gpu:"Nvidia 1080ti" ');
  });

  it('stops searching after no values are returned', async function () {
    const emptyTagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/browser/values/',
      body: [],
    });

    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    wrapper.update();

    // Do 3 searches, the first will find nothing, so no more requests should be made
    setQuery(wrapper, 'browser:Nothing');
    await tick();

    setQuery(wrapper, 'browser:NothingE');
    await tick();

    setQuery(wrapper, 'browser:NothingEls');
    await tick();

    expect(emptyTagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('continues searching after no values if query changes', async function () {
    const emptyTagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/browser/values/',
      body: [],
    });

    const wrapper = mountWithTheme(<SearchBar {...props} />, options);
    await tick();
    wrapper.update();

    setQuery(wrapper, 'browser:Nothing');
    setQuery(wrapper, 'browser:Something');

    expect(emptyTagValuesMock).toHaveBeenCalledTimes(2);
  });
});
