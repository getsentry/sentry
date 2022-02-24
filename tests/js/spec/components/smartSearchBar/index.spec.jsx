import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import {SmartSearchBar} from 'sentry/components/smartSearchBar';
import TagStore from 'sentry/stores/tagStore';

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
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    tagValuesMock.mockClear();
    supportedTags = TagStore.getAllTags();
    supportedTags.firstRelease = {
      key: 'firstRelease',
      name: 'firstRelease',
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
      // 1 items because of headers ("Tags")
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
      // one search group because only showing tags now
      expect(searchBar.state.searchGroups).toHaveLength(1);
      expect(searchBar.state.activeSearchItem).toEqual(-1);
    });

    it('shows errors on incorrect tokens', async function () {
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

    it('keeps the negation operator is present', function () {
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
      textarea.simulate('change', {target: {value: 'event.type:error !ti'}});
      mockCursorPosition(searchBar, 20);
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
});
