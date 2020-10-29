import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import {SmartSearchBar} from 'app/components/smartSearchBar';
import {addSpace, removeSpace} from 'app/components/smartSearchBar/utils';
import TagStore from 'app/stores/tagStore';

describe('addSpace()', function () {
  it('should add a space when there is no trailing space', function () {
    expect(addSpace('one')).toEqual('one ');
  });

  it('should not add another space when there is already one', function () {
    expect(addSpace('one ')).toEqual('one ');
  });

  it('should leave the empty string alone', function () {
    expect(addSpace('')).toEqual('');
  });
});

describe('removeSpace()', function () {
  it('should remove a trailing space', function () {
    expect(removeSpace('one ')).toEqual('one');
  });

  it('should not remove the last character if it is not a space', function () {
    expect(removeSpace('one')).toEqual('one');
  });

  it('should leave the empty string alone', function () {
    expect(removeSpace('')).toEqual('');
  });
});

describe('SmartSearchBar', function () {
  let options, organization, supportedTags;
  let environmentTagValuesMock;
  const tagValuesMock = jest.fn(() => Promise.resolve([]));

  beforeEach(function () {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    tagValuesMock.mockClear();
    supportedTags = TagStore.getAllTags();
    supportedTags.firstRelease = {
      key: 'firstRelease',
      name: 'firstRelease',
    };
    organization = TestStubs.Organization({id: '123'});

    const location = {
      pathname: '/organizations/org-slug/recent-searches/',
      query: {
        projectId: '0',
      },
    };

    options = TestStubs.routerContext([
      {
        organization,
        location,
        router: {location},
      },
    ]);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    environmentTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/environment/values/',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('quotes in values with spaces when autocompleting', async function () {
    jest.useRealTimers();
    const getTagValuesMock = jest.fn().mockImplementation(() => {
      return Promise.resolve(['this is filled with spaces']);
    });
    const onSearch = jest.fn();
    const props = {
      orgId: 'org-slug',
      projectId: '0',
      query: '',
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };
    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('input').simulate('focus');
    searchBar.find('input').simulate('change', {target: {value: 'device:this'}});
    await tick();

    const preventDefault = jest.fn();
    searchBar.find('input').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('input').simulate('keyDown', {key: 'Enter', preventDefault});
    await tick();

    expect(searchBar.find('input').props().value).toEqual(
      'device:"this is filled with spaces"'
    );
  });

  it('escapes quotes in values properly when autocompleting', async function () {
    jest.useRealTimers();
    const getTagValuesMock = jest.fn().mockImplementation(() => {
      return Promise.resolve(['this " is " filled " with " quotes']);
    });
    const onSearch = jest.fn();
    const props = {
      orgId: 'org-slug',
      projectId: '0',
      query: '',
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };
    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('input').simulate('focus');
    searchBar.find('input').simulate('change', {target: {value: 'device:this'}});
    await tick();

    const preventDefault = jest.fn();
    searchBar.find('input').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('input').simulate('keyDown', {key: 'Enter', preventDefault});
    await tick();

    expect(searchBar.find('input').props().value).toEqual(
      'device:"this \\" is \\" filled \\" with \\" quotes"'
    );
  });

  it('does not preventDefault when there are no search items and is loading and enter is pressed', async function () {
    jest.useRealTimers();
    const getTagValuesMock = jest.fn().mockImplementation(() => {
      return new Promise(() => {});
    });
    const onSearch = jest.fn();
    const props = {
      orgId: 'org-slug',
      projectId: '0',
      query: '',
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };

    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('input').simulate('focus');
    searchBar.find('input').simulate('change', {target: {value: 'browser:'}});
    await tick();

    // press enter
    const preventDefault = jest.fn();
    searchBar.find('input').simulate('keyDown', {key: 'Enter', preventDefault});
    expect(onSearch).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('calls preventDefault when there are existing search items and is loading and enter is pressed', async function () {
    jest.useRealTimers();
    const getTagValuesMock = jest.fn().mockImplementation(() => {
      return new Promise(() => {});
    });
    const onSearch = jest.fn();
    const props = {
      orgId: 'org-slug',
      projectId: '0',
      query: '',
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };

    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('input').simulate('focus');
    searchBar.find('input').simulate('change', {target: {value: 'bro'}});
    await tick();

    // Can't select with tab
    searchBar.find('input').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('input').simulate('keyDown', {key: 'Tab'});
    expect(onSearch).not.toHaveBeenCalled();

    searchBar.find('input').simulate('change', {target: {value: 'browser:'}});
    await tick();

    // press enter
    const preventDefault = jest.fn();
    searchBar.find('input').simulate('keyDown', {key: 'Enter', preventDefault});
    expect(onSearch).not.toHaveBeenCalled();
    // Prevent default since we need to select an item
    expect(preventDefault).toHaveBeenCalled();
  });

  describe('componentWillReceiveProps()', function () {
    it('should add a space when setting state.query', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          supportedTags={supportedTags}
          query="one"
        />,
        options
      );

      expect(searchBar.state().query).toEqual('one ');
    });

    it('should update state.query if props.query is updated from outside', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          supportedTags={supportedTags}
          query="one"
        />,
        options
      );

      searchBar.setProps({query: 'two'});

      expect(searchBar.state().query).toEqual('two ');
    });

    it('should not reset user input if a noop props change happens', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          supportedTags={supportedTags}
          query="one"
        />,
        options
      );
      searchBar.setState({query: 'two'});

      searchBar.setProps({query: 'one'});

      expect(searchBar.state().query).toEqual('two');
    });

    it('should reset user input if a meaningful props change happens', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          supportedTags={supportedTags}
          query="one"
        />,
        options
      );
      searchBar.setState({query: 'two'});

      searchBar.setProps({query: 'three'});

      expect(searchBar.state().query).toEqual('three ');
    });
  });

  describe('getQueryTerms()', function () {
    it('should extract query terms from a query string', function () {
      let query = 'tagname: ';
      expect(SmartSearchBar.getQueryTerms(query, query.length)).toEqual(['tagname:']);

      query = 'tagname:derp browser:';
      expect(SmartSearchBar.getQueryTerms(query, query.length)).toEqual([
        'tagname:derp',
        'browser:',
      ]);

      query = '   browser:"Chrome 33.0"    ';
      expect(SmartSearchBar.getQueryTerms(query, query.length)).toEqual([
        'browser:"Chrome 33.0"',
      ]);
    });
  });

  describe('getLastTermIndex()', function () {
    it('should provide the index of the last query term, given cursor index', function () {
      let query = 'tagname:';
      expect(SmartSearchBar.getLastTermIndex(query, 0)).toEqual(8);

      query = 'tagname:foo'; // 'f' (index 9)
      expect(SmartSearchBar.getLastTermIndex(query, 9)).toEqual(11);

      query = 'tagname:foo anothertag:bar'; // 'f' (index 9)
      expect(SmartSearchBar.getLastTermIndex(query, 9)).toEqual(11);
    });
  });

  describe('clearSearch()', function () {
    it('clears the query', function () {
      const props = {
        organization,
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved',
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();

      searchBar.clearSearch();

      expect(searchBar.state.query).toEqual('');
    });

    it('calls onSearch()', async function () {
      const props = {
        organization,
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved',
        supportedTags,
        onSearch: jest.fn(),
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();

      await searchBar.clearSearch();
      expect(props.onSearch).toHaveBeenCalledWith('');
    });
  });

  describe('onQueryFocus()', function () {
    it('displays the drop down', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          supportedTags={supportedTags}
          onGetTagValues={tagValuesMock}
        />,
        options
      ).instance();
      expect(searchBar.state.dropdownVisible).toBe(false);

      searchBar.onQueryFocus();

      expect(searchBar.state.dropdownVisible).toBe(true);
    });

    it('displays dropdown in hasPinnedSearch mode', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          supportedTags={supportedTags}
          onGetTagValues={tagValuesMock}
          hasPinnedSearch
        />,
        options
      ).instance();
      expect(searchBar.state.dropdownVisible).toBe(false);

      searchBar.onQueryFocus();

      expect(searchBar.state.dropdownVisible).toBe(true);
    });
  });

  describe('onQueryBlur()', function () {
    it('hides the drop down', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar organization={organization} supportedTags={supportedTags} />,
        options
      ).instance();
      searchBar.state.dropdownVisible = true;

      jest.useFakeTimers();
      searchBar.onQueryBlur({target: {value: 'test'}});
      jest.advanceTimersByTime(201); // doesn't close until 200ms

      expect(searchBar.state.dropdownVisible).toBe(false);
    });
  });

  describe('onKeyUp()', function () {
    describe('escape', function () {
      it('blurs the input', function () {
        const wrapper = mountWithTheme(
          <SmartSearchBar organization={organization} supportedTags={supportedTags} />,
          options
        );
        wrapper.setState({dropdownVisible: true});

        const instance = wrapper.instance();
        jest.spyOn(instance, 'blur');

        wrapper.find('input').simulate('keyup', {key: 'Escape'});

        expect(instance.blur).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('render()', function () {
    it('invokes onSearch() when submitting the form', function () {
      const stubbedOnSearch = jest.fn();
      const wrapper = mountWithTheme(
        <SmartSearchBar
          onSearch={stubbedOnSearch}
          organization={organization}
          query="is:unresolved"
          supportedTags={supportedTags}
        />,
        options
      );

      wrapper.find('form').simulate('submit', {
        preventDefault() {},
      });

      expect(stubbedOnSearch).toHaveBeenCalledWith('is:unresolved');
    });

    it('invokes onSearch() when search is cleared', async function () {
      jest.useRealTimers();
      const props = {
        organization,
        query: 'is:unresolved',
        supportedTags,
        onSearch: jest.fn(),
      };
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);

      wrapper.find('button[aria-label="Clear search"]').simulate('click');

      await tick();
      expect(props.onSearch).toHaveBeenCalledWith('');
    });

    it('invokes onSearch() on submit in hasPinnedSearch mode', function () {
      const stubbedOnSearch = jest.fn();
      const wrapper = mountWithTheme(
        <SmartSearchBar
          onSearch={stubbedOnSearch}
          organization={organization}
          query="is:unresolved"
          supportedTags={supportedTags}
          hasPinnedSearch
        />,
        options
      );

      wrapper.find('form').simulate('submit');

      expect(stubbedOnSearch).toHaveBeenCalledWith('is:unresolved');
    });
  });

  it('handles an empty query', function () {
    const props = {
      query: '',
      defaultQuery: 'is:unresolved',
      organization,
      supportedTags,
    };
    const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
    expect(wrapper.state('query')).toEqual('');
  });

  describe('updateAutoCompleteItems()', function () {
    beforeEach(function () {
      jest.useFakeTimers();
    });
    it('sets state when empty', function () {
      const props = {
        query: '',
        organization,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      expect(searchBar.state.searchTerm).toEqual('');
      expect(searchBar.state.searchGroups).toEqual([]);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('sets state when incomplete tag', async function () {
      const props = {
        query: 'fu',
        organization,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchGroups).toEqual([
        expect.objectContaining({children: []}),
      ]);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('sets state when incomplete tag has negation operator', async function () {
      const props = {
        query: '!fu',
        organization,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchGroups).toEqual([
        expect.objectContaining({children: []}),
      ]);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('sets state when incomplete tag as second input', async function () {
      const props = {
        query: 'is:unresolved fu',
        organization,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      searchBar.getCursorPosition = jest.fn();
      searchBar.getCursorPosition.mockReturnValue(15); // end of line
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      // 1 items because of headers ("Tags")
      expect(searchBar.state.searchGroups).toHaveLength(1);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('does not request values when tag is environments', function () {
      const props = {
        query: 'environment:production',
        excludeEnvironment: true,
        organization,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      jest.advanceTimersByTime(301);
      expect(environmentTagValuesMock).not.toHaveBeenCalled();
    });

    it('does not request values when tag is `timesSeen`', function () {
      // This should never get called
      const mock = MockApiClient.addMockResponse({
        url: '/projects/123/456/tags/timesSeen/values/',
        body: [],
      });
      const props = {
        query: 'timesSeen:',
        organization,
        supportedTags,
      };
      const searchBar = mountWithTheme(
        <SmartSearchBar {...props} api={new Client()} />,
        options
      ).instance();
      searchBar.updateAutoCompleteItems();
      jest.advanceTimersByTime(301);
      expect(mock).not.toHaveBeenCalled();
    });

    it('requests values when tag is `firstRelease`', function () {
      const mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [],
      });
      const props = {
        orgId: 'org-slug',
        projectId: '0',
        query: 'firstRelease:',
        organization,
        supportedTags,
      };

      const searchBar = mountWithTheme(
        <SmartSearchBar {...props} api={new Client()} />,
        options
      ).instance();
      searchBar.updateAutoCompleteItems();

      jest.advanceTimersByTime(301);
      expect(mock).toHaveBeenCalledWith(
        '/organizations/org-slug/releases/',
        expect.objectContaining({
          method: 'GET',
          query: {
            project: '0',
            per_page: 5, // Limit results to 5 for autocomplete
          },
        })
      );
    });
  });

  describe('onAutoComplete()', function () {
    it('completes terms from the list', function () {
      const props = {
        query: 'event.type:error ',
        organization,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.onAutoComplete('myTag:', {type: 'tag'});
      expect(searchBar.state.query).toEqual('event.type:error myTag:');
    });

    it('completes values if cursor is not at the end', function () {
      const props = {
        query: 'id: event.type:error ',
        organization,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.getCursorPosition = jest.fn().mockReturnValueOnce(3);
      searchBar.onAutoComplete('12345', {type: 'tag-value'});
      expect(searchBar.state.query).toEqual('id:12345 event.type:error ');
    });

    it('completes values if cursor is at the end', function () {
      const props = {
        query: 'event.type:error id:',
        organization,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.getCursorPosition = jest.fn().mockReturnValueOnce(20);
      searchBar.onAutoComplete('12345', {type: 'tag-value'});
      expect(searchBar.state.query).toEqual('event.type:error id:12345 ');
    });

    it('keeps the negation operator is present', function () {
      const props = {
        query: '',
        organization,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const input = smartSearchBar.find('input');
      // start typing part of the tag prefixed by the negation operator!
      input.simulate('change', {target: {value: 'event.type:error !ti'}});
      searchBar.getCursorPosition = jest.fn().mockReturnValueOnce(20);
      // use autocompletion to do the rest
      searchBar.onAutoComplete('title:', {});
      expect(searchBar.state.query).toEqual('event.type:error !title:');
    });

    it('removes wildcard', function () {
      const props = {
        query: '',
        organization,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const input = smartSearchBar.find('input');

      // leading wildcard
      input.simulate('change', {target: {value: 'event.type:*err'}});
      searchBar.getCursorPosition = jest.fn().mockReturnValueOnce(20);
      // use autocompletion to do the rest
      searchBar.onAutoComplete('error', {});
      expect(searchBar.state.query).toEqual('event.type:error');

      // trailing wildcard
      input.simulate('change', {target: {value: 'event.type:err*'}});
      searchBar.getCursorPosition = jest.fn().mockReturnValueOnce(20);
      // use autocompletion to do the rest
      searchBar.onAutoComplete('error', {});
      expect(searchBar.state.query).toEqual('event.type:error');
    });

    it('handles special case for user tag', function () {
      const props = {
        query: '',
        organization,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const input = smartSearchBar.find('input');

      input.simulate('change', {target: {value: 'user:'}});
      searchBar.getCursorPosition = jest.fn().mockReturnValueOnce(5);
      searchBar.onAutoComplete('id:1', {});
      expect(searchBar.state.query).toEqual('user:"id:1"');

      // try it with the SEARCH_WILDCARD
      input.simulate('change', {target: {value: 'user:1*'}});
      searchBar.getCursorPosition = jest.fn().mockReturnValueOnce(5);
      searchBar.onAutoComplete('ip:127.0.0.1', {});
      expect(searchBar.state.query).toEqual('user:"ip:127.0.0.1"');
    });
  });

  describe('onTogglePinnedSearch()', function () {
    let pinRequest, unpinRequest;
    beforeEach(function () {
      pinRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: [],
      });
      unpinRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'POST',
        body: {},
      });
    });

    it('does not pin when query is empty', async function () {
      const wrapper = mountWithTheme(
        <SmartSearchBar
          api={new Client()}
          organization={organization}
          query=""
          supportedTags={supportedTags}
          savedSearchType={0}
          hasPinnedSearch
        />,
        options
      );
      wrapper.find('button[aria-label="Pin this search"]').simulate('click');
      await wrapper.update();

      expect(pinRequest).not.toHaveBeenCalled();
    });

    it('adds pins', async function () {
      const wrapper = mountWithTheme(
        <SmartSearchBar
          api={new Client()}
          organization={organization}
          query="is:unresolved"
          supportedTags={supportedTags}
          savedSearchType={0}
          hasPinnedSearch
        />,
        options
      );
      wrapper.find('button[aria-label="Pin this search"]').simulate('click');
      await wrapper.update();

      expect(pinRequest).toHaveBeenCalled();
      expect(unpinRequest).not.toHaveBeenCalled();
    });

    it('removes pins', async function () {
      const pinnedSearch = TestStubs.Search({isPinned: true});
      const wrapper = mountWithTheme(
        <SmartSearchBar
          api={new Client()}
          organization={organization}
          query="is:unresolved"
          supportedTags={supportedTags}
          savedSearchType={0}
          pinnedSearch={pinnedSearch}
          hasPinnedSearch
        />,
        options
      );

      wrapper.find('button[aria-label="Unpin this search"]').simulate('click');
      await wrapper.update();

      expect(pinRequest).not.toHaveBeenCalled();
      expect(unpinRequest).toHaveBeenCalled();
    });
  });
});
