import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import {SmartSearchBar} from 'sentry/components/smartSearchBar';
import {ShortcutType} from 'sentry/components/smartSearchBar/types';
import {shortcuts} from 'sentry/components/smartSearchBar/utils';
import TagStore from 'sentry/stores/tagStore';
import {FieldKey} from 'sentry/utils/fields';

describe('SmartSearchBar', function () {
  let location, options, organization, supportedTags;
  let environmentTagValuesMock;
  const tagValuesMock = jest.fn(() => Promise.resolve([]));

  const mockCursorPosition = (component, pos) => {
    delete component.cursorPosition;
    Object.defineProperty(component, 'cursorPosition', {
      get: jest.fn().mockReturnValue(pos),
      configurable: true,
    });
  };

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TestStubs.Tags());
    tagValuesMock.mockClear();
    supportedTags = TagStore.getStateTags();
    supportedTags.firstRelease = {
      key: 'firstRelease',
      name: 'firstRelease',
    };
    supportedTags.is = {
      key: 'is',
      name: 'is',
    };

    organization = TestStubs.Organization({id: '123'});

    location = {
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
      location,
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };
    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('textarea').simulate('focus');
    searchBar.find('textarea').simulate('change', {target: {value: 'device:this'}});
    await tick();

    const preventDefault = jest.fn();
    searchBar.find('textarea').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('textarea').simulate('keyDown', {key: 'Enter', preventDefault});
    await tick();

    expect(searchBar.find('textarea').props().value).toEqual(
      'device:"this is filled with spaces" '
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
      location,
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };
    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('textarea').simulate('focus');
    searchBar.find('textarea').simulate('change', {target: {value: 'device:this'}});
    await tick();

    const preventDefault = jest.fn();
    searchBar.find('textarea').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('textarea').simulate('keyDown', {key: 'Enter', preventDefault});
    await tick();

    expect(searchBar.find('textarea').props().value).toEqual(
      'device:"this \\" is \\" filled \\" with \\" quotes" '
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
      location,
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };

    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('textarea').simulate('focus');
    searchBar.find('textarea').simulate('change', {target: {value: 'browser:'}});
    await tick();

    // press enter
    const preventDefault = jest.fn();
    searchBar.find('textarea').simulate('keyDown', {key: 'Enter', preventDefault});
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
      location,
      organization,
      supportedTags,
      onGetTagValues: getTagValuesMock,
      onSearch,
    };

    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('textarea').simulate('focus');
    searchBar.find('textarea').simulate('change', {target: {value: 'bro'}});
    await tick();

    // Can't select with tab
    searchBar.find('textarea').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('textarea').simulate('keyDown', {key: 'Tab'});
    expect(onSearch).not.toHaveBeenCalled();

    searchBar.find('textarea').simulate('change', {target: {value: 'browser:'}});
    await tick();

    // press enter
    const preventDefault = jest.fn();
    searchBar.find('textarea').simulate('keyDown', {key: 'Enter', preventDefault});
    expect(onSearch).not.toHaveBeenCalled();
    // Prevent default since we need to select an item
    expect(preventDefault).toHaveBeenCalled();
  });

  describe('componentWillReceiveProps()', function () {
    it('should add a space when setting state.query', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          location={location}
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
          location={location}
          supportedTags={supportedTags}
          query="one"
        />,
        options
      );

      searchBar.setProps({query: 'two'});

      expect(searchBar.state().query).toEqual('two ');
    });

    it('should update state.query if props.query is updated to null/undefined from outside', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          location={location}
          supportedTags={supportedTags}
          query="one"
        />,
        options
      );

      searchBar.setProps({query: null});

      expect(searchBar.state().query).toEqual('');
    });

    it('should not reset user textarea if a noop props change happens', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          location={location}
          supportedTags={supportedTags}
          query="one"
        />,
        options
      );
      searchBar.setState({query: 'two'});

      searchBar.setProps({query: 'one'});

      expect(searchBar.state().query).toEqual('two');
    });

    it('should reset user textarea if a meaningful props change happens', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          location={location}
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

  describe('clearSearch()', function () {
    it('clears the query', function () {
      const props = {
        organization,
        location,
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
        location,
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
          location={location}
          supportedTags={supportedTags}
          onGetTagValues={tagValuesMock}
        />,
        options
      ).instance();
      expect(searchBar.state.inputHasFocus).toBe(false);

      searchBar.onQueryFocus();

      expect(searchBar.state.inputHasFocus).toBe(true);
    });

    it('displays dropdown in hasPinnedSearch mode', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          location={location}
          supportedTags={supportedTags}
          onGetTagValues={tagValuesMock}
          hasPinnedSearch
        />,
        options
      ).instance();
      expect(searchBar.state.inputHasFocus).toBe(false);

      searchBar.onQueryFocus();

      expect(searchBar.state.inputHasFocus).toBe(true);
    });
  });

  describe('onQueryBlur()', function () {
    it('hides the drop down', function () {
      const searchBar = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          location={location}
          supportedTags={supportedTags}
        />,
        options
      ).instance();
      searchBar.state.inputHasFocus = true;

      jest.useFakeTimers();
      searchBar.onQueryBlur({target: {value: 'test'}});
      jest.advanceTimersByTime(201); // doesn't close until 200ms

      expect(searchBar.state.inputHasFocus).toBe(false);
    });
  });

  describe('onPaste()', function () {
    it('trims pasted content', function () {
      const onChange = jest.fn();
      const wrapper = mountWithTheme(
        <SmartSearchBar
          organization={organization}
          location={location}
          supportedTags={supportedTags}
          onChange={onChange}
        />,
        options
      );
      wrapper.setState({inputHasFocus: true});

      const input = ' something ';
      wrapper
        .find('textarea')
        .simulate('paste', {clipboardData: {getData: () => input, value: input}});
      wrapper.update();

      expect(onChange).toHaveBeenCalledWith('something', expect.anything());
    });
  });

  describe('onKeyUp()', function () {
    describe('escape', function () {
      it('blurs the textarea', function () {
        const wrapper = mountWithTheme(
          <SmartSearchBar
            organization={organization}
            location={location}
            supportedTags={supportedTags}
          />,
          options
        );
        wrapper.setState({inputHasFocus: true});

        const instance = wrapper.instance();
        jest.spyOn(instance, 'blur');

        wrapper.find('textarea').simulate('keyup', {key: 'Escape'});

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
          location={location}
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
        location,
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
          location={location}
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
      location,
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
        location,
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
        location,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      wrapper.find('textarea').simulate('focus');
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
        location,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      wrapper.find('textarea').simulate('focus');
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchGroups).toEqual([
        expect.objectContaining({children: []}),
      ]);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('sets state when incomplete tag as second textarea', async function () {
      const props = {
        query: 'is:unresolved fu',
        organization,
        location,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      // Cursor is at end of line
      mockCursorPosition(searchBar, 15);
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      // 2 items because of headers ("Tags")
      expect(searchBar.state.searchGroups).toHaveLength(1);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('does not request values when tag is environments', function () {
      const props = {
        query: 'environment:production',
        excludeEnvironment: true,
        location,
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
        location,
        organization,
        supportedTags,
      };

      const searchBar = mountWithTheme(
        <SmartSearchBar {...props} api={new Client()} />,
        options
      ).instance();
      mockCursorPosition(searchBar, 13);
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

    it('shows operator autocompletion', async function () {
      const props = {
        query: 'is:unresolved',
        organization,
        location,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      // Cursor is on ':'
      mockCursorPosition(searchBar, 3);
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      // two search groups because of operator suggestions
      expect(searchBar.state.searchGroups).toHaveLength(2);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('responds to cursor changes', async function () {
      const props = {
        query: 'is:unresolved',
        organization,
        location,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      // Cursor is on ':'
      mockCursorPosition(searchBar, 3);
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      // two search groups tags and values
      expect(searchBar.state.searchGroups).toHaveLength(2);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
      mockCursorPosition(searchBar, 1);
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      // one search group because showing tags
      expect(searchBar.state.searchGroups).toHaveLength(1);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('shows errors on incorrect tokens', function () {
      const props = {
        query: 'tag: is: has: ',
        organization,
        location,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      wrapper.find('Filter').forEach(filter => {
        expect(filter.prop('invalid')).toBe(true);
      });
    });

    it('handles autocomplete race conditions when cursor position changed', async function () {
      const props = {
        query: 'is:',
        organization,
        location,
        supportedTags,
      };

      jest.useFakeTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      // Cursor is on ':'
      searchBar.generateValueAutocompleteGroup = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                searchItems: [],
                recentSearchItems: [],
                tagName: 'test',
                type: 'value',
              });
            }, [300]);
          })
      );
      mockCursorPosition(searchBar, 3);
      searchBar.updateAutoCompleteItems();
      jest.advanceTimersByTime(200);

      // Move cursor off of the place the update was called before it's done at 300ms
      mockCursorPosition(searchBar, 0);

      jest.advanceTimersByTime(101);

      // Get the pending promises to resolve
      await Promise.resolve();
      wrapper.update();

      expect(searchBar.state.searchGroups).toHaveLength(0);
    });

    it('handles race conditions when query changes from default state', async function () {
      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };

      jest.useFakeTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      // Cursor is on ':'
      searchBar.getRecentSearches = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve([]);
            }, [300]);
          })
      );
      mockCursorPosition(searchBar, 0);
      searchBar.updateAutoCompleteItems();
      jest.advanceTimersByTime(200);

      // Change query before it's done at 300ms
      searchBar.updateQuery('is:');

      jest.advanceTimersByTime(101);

      // Get the pending promises to resolve
      await Promise.resolve();
      wrapper.update();

      expect(searchBar.state.searchGroups).toHaveLength(0);
    });

    it('correctly groups nested keys', async function () {
      const props = {
        query: 'nest',
        organization,
        location,
        supportedTags: {
          nested: {
            key: 'nested',
            name: 'nested',
          },
          'nested.child': {
            key: 'nested.child',
            name: 'nested.child',
          },
        },
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      // Cursor is at end of line
      mockCursorPosition(searchBar, 4);
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();

      expect(searchBar.state.searchGroups).toHaveLength(1);
      expect(searchBar.state.searchGroups[0].children).toHaveLength(1);
      expect(searchBar.state.searchGroups[0].children[0].title).toBe('nested');
      expect(searchBar.state.searchGroups[0].children[0].children).toHaveLength(1);
      expect(searchBar.state.searchGroups[0].children[0].children[0].title).toBe(
        'nested.child'
      );
    });

    it('correctly groups nested keys without a parent', async function () {
      const props = {
        query: 'nest',
        organization,
        location,
        supportedTags: {
          'nested.child1': {
            key: 'nested.child1',
            name: 'nested.child1',
          },
          'nested.child2': {
            key: 'nested.child2',
            name: 'nested.child2',
          },
        },
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      // Cursor is at end of line
      mockCursorPosition(searchBar, 4);
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();

      expect(searchBar.state.searchGroups).toHaveLength(1);
      expect(searchBar.state.searchGroups[0].children).toHaveLength(1);
      expect(searchBar.state.searchGroups[0].children[0].title).toBe('nested');
      expect(searchBar.state.searchGroups[0].children[0].children).toHaveLength(2);
      expect(searchBar.state.searchGroups[0].children[0].children[0].title).toBe(
        'nested.child1'
      );
      expect(searchBar.state.searchGroups[0].children[0].children[1].title).toBe(
        'nested.child2'
      );
    });
  });

  describe('cursorSearchTerm', function () {
    it('selects the correct free text word', async function () {
      jest.useRealTimers();

      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');

      textarea.simulate('focus');
      mockCursorPosition(searchBar, 6);
      textarea.simulate('change', {target: {value: 'typ testest    err'}});
      await tick();

      // Expect the correct search term to be selected
      const cursorSearchTerm = searchBar.cursorSearchTerm;
      expect(cursorSearchTerm.searchTerm).toEqual('testest');
      expect(cursorSearchTerm.start).toBe(4);
      expect(cursorSearchTerm.end).toBe(11);
    });

    it('selects the correct free text word (last word)', async function () {
      jest.useRealTimers();

      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');

      textarea.simulate('focus');
      mockCursorPosition(searchBar, 15);
      textarea.simulate('change', {target: {value: 'typ testest    err'}});
      await tick();

      // Expect the correct search term to be selected
      const cursorSearchTerm = searchBar.cursorSearchTerm;
      expect(cursorSearchTerm.searchTerm).toEqual('err');
      expect(cursorSearchTerm.start).toBe(15);
      expect(cursorSearchTerm.end).toBe(18);
    });

    it('selects the correct free text word (first word)', async function () {
      jest.useRealTimers();

      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');

      textarea.simulate('focus');
      mockCursorPosition(searchBar, 1);
      textarea.simulate('change', {target: {value: 'typ testest    err'}});
      await tick();

      // Expect the correct search term to be selected
      const cursorSearchTerm = searchBar.cursorSearchTerm;
      expect(cursorSearchTerm.searchTerm).toEqual('typ');
      expect(cursorSearchTerm.start).toBe(0);
      expect(cursorSearchTerm.end).toBe(3);
    });

    it('search term location correctly selects key of filter token', async function () {
      jest.useRealTimers();

      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');

      textarea.simulate('focus');
      mockCursorPosition(searchBar, 6);
      textarea.simulate('change', {target: {value: 'typ device:123'}});
      await tick();

      // Expect the correct search term to be selected
      const cursorSearchTerm = searchBar.cursorSearchTerm;
      expect(cursorSearchTerm.searchTerm).toEqual('device');
      expect(cursorSearchTerm.start).toBe(4);
      expect(cursorSearchTerm.end).toBe(10);
    });

    it('search term location correctly selects value of filter token', async function () {
      jest.useRealTimers();

      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');

      textarea.simulate('focus');
      mockCursorPosition(searchBar, 11);
      textarea.simulate('change', {target: {value: 'typ device:123'}});
      await tick();

      // Expect the correct search term to be selected
      const cursorSearchTerm = searchBar.cursorSearchTerm;
      expect(cursorSearchTerm.searchTerm).toEqual('123');
      expect(cursorSearchTerm.start).toBe(11);
      expect(cursorSearchTerm.end).toBe(14);
    });
  });

  describe('getTagKeys()', function () {
    it('filters both keys and descriptions', async function () {
      jest.useRealTimers();

      const props = {
        query: 'event',
        organization,
        location,
        supportedTags: {
          [FieldKey.DEVICE_CHARGING]: {
            key: FieldKey.DEVICE_CHARGING,
          },
          [FieldKey.EVENT_TYPE]: {
            key: FieldKey.EVENT_TYPE,
          },
          [FieldKey.DEVICE_ARCH]: {
            key: FieldKey.DEVICE_ARCH,
          },
        },
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();

      mockCursorPosition(searchBar, 3);
      searchBar.updateAutoCompleteItems();

      await tick();

      expect(searchBar.state.flatSearchItems).toHaveLength(2);
      expect(searchBar.state.flatSearchItems[0].title).toBe(FieldKey.EVENT_TYPE);
      expect(searchBar.state.flatSearchItems[1].title).toBe(FieldKey.DEVICE_CHARGING);
    });

    it('filters only keys', async function () {
      jest.useRealTimers();

      const props = {
        query: 'device',
        organization,
        location,
        supportedTags: {
          [FieldKey.DEVICE_CHARGING]: {
            key: FieldKey.DEVICE_CHARGING,
          },
          [FieldKey.EVENT_TYPE]: {
            key: FieldKey.EVENT_TYPE,
          },
          [FieldKey.DEVICE_ARCH]: {
            key: FieldKey.DEVICE_ARCH,
          },
        },
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();

      mockCursorPosition(searchBar, 2);
      searchBar.updateAutoCompleteItems();

      await tick();

      expect(searchBar.state.flatSearchItems).toHaveLength(2);
      expect(searchBar.state.flatSearchItems[0].title).toBe(FieldKey.DEVICE_ARCH);
      expect(searchBar.state.flatSearchItems[1].title).toBe(FieldKey.DEVICE_CHARGING);
    });

    it('filters only descriptions', async function () {
      jest.useRealTimers();

      const props = {
        query: 'time',
        organization,
        location,
        supportedTags: {
          [FieldKey.DEVICE_CHARGING]: {
            key: FieldKey.DEVICE_CHARGING,
          },
          [FieldKey.EVENT_TYPE]: {
            key: FieldKey.EVENT_TYPE,
          },
          [FieldKey.DEVICE_ARCH]: {
            key: FieldKey.DEVICE_ARCH,
          },
        },
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();

      mockCursorPosition(searchBar, 4);
      searchBar.updateAutoCompleteItems();

      await tick();

      expect(searchBar.state.flatSearchItems).toHaveLength(1);
      expect(searchBar.state.flatSearchItems[0].title).toBe(FieldKey.DEVICE_CHARGING);
    });
  });

  describe('onAutoComplete()', function () {
    it('completes terms from the list', function () {
      const props = {
        query: 'event.type:error ',
        organization,
        location,
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
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      mockCursorPosition(searchBar, 3);
      searchBar.onAutoComplete('12345', {type: 'tag-value'});
      expect(searchBar.state.query).toEqual('id:12345 event.type:error ');
    });

    it('completes values if cursor is at the end', function () {
      const props = {
        query: 'event.type:error id:',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      mockCursorPosition(searchBar, 20);
      searchBar.onAutoComplete('12345', {type: 'tag-value'});
      expect(searchBar.state.query).toEqual('event.type:error id:12345 ');
    });

    it('triggers onChange', function () {
      const onChange = jest.fn();
      const props = {
        query: 'event.type:error id:',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(
        <SmartSearchBar {...props} onChange={onChange} />,
        options
      ).instance();
      mockCursorPosition(searchBar, 20);
      searchBar.onAutoComplete('12345', {type: 'tag-value'});
      expect(onChange).toHaveBeenCalledWith(
        'event.type:error id:12345 ',
        expect.anything()
      );
    });

    it('keeps the negation operator present', async function () {
      jest.useRealTimers();
      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');
      // start typing part of the tag prefixed by the negation operator!
      textarea.simulate('focus');
      textarea.simulate('change', {target: {value: 'event.type:error !ti'}});
      mockCursorPosition(searchBar, 20);
      await tick();
      // Expect the correct search term to be selected
      const cursorSearchTerm = searchBar.cursorSearchTerm;
      expect(cursorSearchTerm.searchTerm).toEqual('ti');
      expect(cursorSearchTerm.start).toBe(18);
      expect(cursorSearchTerm.end).toBe(20);
      // use autocompletion to do the rest
      searchBar.onAutoComplete('title:', {});
      expect(searchBar.state.query).toEqual('event.type:error !title:');
    });

    it('handles special case for user tag', function () {
      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');

      textarea.simulate('change', {target: {value: 'user:'}});
      mockCursorPosition(searchBar, 5);
      searchBar.onAutoComplete('id:1', {});
      expect(searchBar.state.query).toEqual('user:"id:1" ');
    });
  });

  it('quotes in predefined values with spaces when autocompleting', async function () {
    jest.useRealTimers();
    const onSearch = jest.fn();
    supportedTags.predefined = {
      key: 'predefined',
      name: 'predefined',
      predefined: true,
      values: ['predefined tag with spaces'],
    };
    const props = {
      orgId: 'org-slug',
      projectId: '0',
      query: '',
      location,
      organization,
      supportedTags,
      onSearch,
    };
    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('textarea').simulate('focus');
    searchBar
      .find('textarea')
      .simulate('change', {target: {value: 'predefined:predefined'}});
    await tick();

    const preventDefault = jest.fn();
    searchBar.find('textarea').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('textarea').simulate('keyDown', {key: 'Enter', preventDefault});
    await tick();

    expect(searchBar.find('textarea').props().value).toEqual(
      'predefined:"predefined tag with spaces" '
    );
  });

  it('escapes quotes in predefined values properly when autocompleting', async function () {
    jest.useRealTimers();
    const onSearch = jest.fn();
    supportedTags.predefined = {
      key: 'predefined',
      name: 'predefined',
      predefined: true,
      values: ['"predefined" "tag" "with" "quotes"'],
    };
    const props = {
      orgId: 'org-slug',
      projectId: '0',
      query: '',
      location,
      organization,
      supportedTags,
      onSearch,
    };
    const searchBar = mountWithTheme(
      <SmartSearchBar {...props} api={new Client()} />,

      options
    );
    searchBar.find('textarea').simulate('focus');
    searchBar
      .find('textarea')
      .simulate('change', {target: {value: 'predefined:predefined'}});
    await tick();

    const preventDefault = jest.fn();
    searchBar.find('textarea').simulate('keyDown', {key: 'ArrowDown'});
    searchBar.find('textarea').simulate('keyDown', {key: 'Enter', preventDefault});
    await tick();

    expect(searchBar.find('textarea').props().value).toEqual(
      'predefined:"\\"predefined\\" \\"tag\\" \\"with\\" \\"quotes\\"" '
    );
  });

  describe('quick actions', () => {
    it('delete first token', async () => {
      const props = {
        query: 'is:unresolved sdk.name:sentry-cocoa has:key',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();

      mockCursorPosition(searchBar, 1);

      await tick();

      const deleteAction = shortcuts.find(a => a.shortcutType === ShortcutType.Delete);

      expect(deleteAction).toBeDefined();
      if (deleteAction) {
        searchBar.runShortcut(deleteAction);

        await tick();

        expect(searchBar.state.query).toEqual('sdk.name:sentry-cocoa has:key');
      }
    });

    it('delete middle token', async () => {
      const props = {
        query: 'is:unresolved sdk.name:sentry-cocoa has:key',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();

      mockCursorPosition(searchBar, 18);

      await tick();

      const deleteAction = shortcuts.find(a => a.shortcutType === ShortcutType.Delete);

      expect(deleteAction).toBeDefined();
      if (deleteAction) {
        searchBar.runShortcut(deleteAction);

        await tick();

        expect(searchBar.state.query).toEqual('is:unresolved has:key');
      }
    });

    it('exclude token', async () => {
      const props = {
        query: 'is:unresolved sdk.name:sentry-cocoa has:key',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();

      mockCursorPosition(searchBar, 18);

      await tick();

      const excludeAction = shortcuts.find(shortcut => shortcut.text === 'Exclude');

      expect(excludeAction).toBeDefined();
      if (excludeAction) {
        searchBar.runShortcut(excludeAction);

        await tick();

        expect(searchBar.state.query).toEqual(
          'is:unresolved !sdk.name:sentry-cocoa has:key '
        );
      }
    });

    it('include token', async () => {
      const props = {
        query: 'is:unresolved !sdk.name:sentry-cocoa has:key',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();

      mockCursorPosition(searchBar, 18);

      await tick();

      const includeAction = shortcuts.find(shortcut => shortcut.text === 'Include');

      expect(includeAction).toBeDefined();
      if (includeAction) {
        searchBar.runShortcut(includeAction);

        await tick();

        expect(searchBar.state.query).toEqual(
          'is:unresolved sdk.name:sentry-cocoa has:key '
        );
      }
    });

    it('replaces the correct word', async function () {
      const props = {
        query: '',
        organization,
        location,
        supportedTags,
      };
      const smartSearchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBar = smartSearchBar.instance();
      const textarea = smartSearchBar.find('textarea');

      textarea.simulate('focus');
      mockCursorPosition(searchBar, 4);
      textarea.simulate('change', {target: {value: 'typ ti err'}});

      await tick();

      // Expect the correct search term to be selected
      const cursorSearchTerm = searchBar.cursorSearchTerm;
      expect(cursorSearchTerm.searchTerm).toEqual('ti');
      expect(cursorSearchTerm.start).toBe(4);
      expect(cursorSearchTerm.end).toBe(6);
      // use autocompletion to do the rest
      searchBar.onAutoComplete('title:', {});
      expect(searchBar.state.query).toEqual('typ title: err');
    });
  });

  describe('Invalid field state', () => {
    it('Shows invalid field state when invalid field is used', async () => {
      const props = {
        query: 'invalid:',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBarInst = searchBar.instance();

      mockCursorPosition(searchBarInst, 8);

      searchBar.find('textarea').simulate('focus');

      searchBarInst.updateAutoCompleteItems();

      await tick();

      expect(searchBarInst.state.searchGroups).toHaveLength(1);
      expect(searchBarInst.state.searchGroups[0].title).toEqual('Keys');
      expect(searchBarInst.state.searchGroups[0].type).toEqual('invalid-tag');
      expect(searchBar.text()).toContain("The field invalid isn't supported here");
    });

    it('Does not show invalid field state when valid field is used', async () => {
      const props = {
        query: 'is:',
        organization,
        location,
        supportedTags,
      };
      const searchBar = mountWithTheme(<SmartSearchBar {...props} />, options);
      const searchBarInst = searchBar.instance();

      mockCursorPosition(searchBarInst, 3);

      searchBarInst.updateAutoCompleteItems();

      await tick();

      expect(searchBar.text()).not.toContain("isn't supported here");
    });
  });
});
