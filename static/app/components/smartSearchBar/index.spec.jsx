import {mountWithTheme} from 'sentry-test/enzyme';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {SmartSearchBar} from 'sentry/components/smartSearchBar';
import {ShortcutType} from 'sentry/components/smartSearchBar/types';
import {shortcuts} from 'sentry/components/smartSearchBar/utils';
import TagStore from 'sentry/stores/tagStore';
import {FieldKey} from 'sentry/utils/fields';

describe('SmartSearchBar', function () {
  let defaultProps, location, options, organization, supportedTags;
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

    defaultProps = {
      query: '',
      organization,
      location,
      supportedTags,
      onGetTagValues: jest.fn().mockResolvedValue([]),
      onSearch: jest.fn(),
    };
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('quotes in values with spaces when autocompleting', async function () {
    const onGetTagValuesMock = jest
      .fn()
      .mockResolvedValue(['this is filled with spaces']);

    render(<SmartSearchBar {...defaultProps} onGetTagValues={onGetTagValuesMock} />);

    const textbox = screen.getByRole('textbox');
    userEvent.click(textbox);
    userEvent.type(textbox, 'device:this');

    const option = await screen.findByText(/this is filled with spaces/);

    userEvent.click(option);

    expect(textbox).toHaveValue('device:"this is filled with spaces" ');
  });

  it('escapes quotes in values properly when autocompleting', async function () {
    const onGetTagValuesMock = jest
      .fn()
      .mockResolvedValue(['this " is " filled " with " quotes']);

    render(<SmartSearchBar {...defaultProps} onGetTagValues={onGetTagValuesMock} />);

    const textbox = screen.getByRole('textbox');
    userEvent.click(textbox);
    userEvent.type(textbox, 'device:this');

    const option = await screen.findByText(/this \\" is \\" filled \\" with \\" quotes/);

    userEvent.click(option);

    expect(textbox).toHaveValue('device:"this \\" is \\" filled \\" with \\" quotes" ');
  });

  it('does not search when pressing enter on a tag without a value', function () {
    const onSearchMock = jest.fn();

    render(<SmartSearchBar {...defaultProps} onSearch={onSearchMock} />);

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'browser:{enter}');

    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('autocompletes value with tab', async function () {
    const onSearchMock = jest.fn();

    render(<SmartSearchBar {...defaultProps} onSearch={onSearchMock} />);

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'bro');

    expect(await screen.findByTestId('search-autocomplete-item')).toBeInTheDocument();

    // down once to 'browser' dropdown item
    userEvent.keyboard('{ArrowDown}{Tab}');

    await waitFor(() => {
      expect(textbox).toHaveValue('browser:');
    });

    expect(textbox).toHaveFocus();

    // Should not have executed the search
    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('autocompletes value with enter', async function () {
    const onSearchMock = jest.fn();

    render(<SmartSearchBar {...defaultProps} onSearch={onSearchMock} />);

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'bro');

    expect(await screen.findByTestId('search-autocomplete-item')).toBeInTheDocument();

    // down once to 'browser' dropdown item
    userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(textbox).toHaveValue('browser:');
    });

    expect(textbox).toHaveFocus();

    // Should not have executed the search
    expect(onSearchMock).not.toHaveBeenCalled();
  });

  describe('componentWillReceiveProps()', function () {
    it('should add a space when setting query', function () {
      render(<SmartSearchBar {...defaultProps} query="one" />);

      expect(screen.getByRole('textbox')).toHaveValue('one ');
    });

    it('updates query when prop changes', function () {
      const {rerender} = render(<SmartSearchBar {...defaultProps} query="one" />);

      rerender(<SmartSearchBar {...defaultProps} query="two" />);

      expect(screen.getByRole('textbox')).toHaveValue('two ');
    });

    it('updates query when prop set to falsey value', function () {
      const {rerender} = render(<SmartSearchBar {...defaultProps} query="one" />);

      rerender(<SmartSearchBar {...defaultProps} query={null} />);

      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('should not reset user textarea if a noop props change happens', function () {
      const {rerender} = render(<SmartSearchBar {...defaultProps} query="one" />);

      userEvent.type(screen.getByRole('textbox'), 'two');

      rerender(<SmartSearchBar {...defaultProps} query="one" />);

      expect(screen.getByRole('textbox')).toHaveValue('one two');
    });

    it('should reset user textarea if a meaningful props change happens', function () {
      const {rerender} = render(<SmartSearchBar {...defaultProps} query="one" />);

      userEvent.type(screen.getByRole('textbox'), 'two');

      rerender(<SmartSearchBar {...defaultProps} query="blah" />);

      expect(screen.getByRole('textbox')).toHaveValue('blah ');
    });
  });

  describe('clear search', function () {
    it('clicking the clear search button clears the query and calls onSearch', function () {
      const mockOnSearch = jest.fn();

      render(
        <SmartSearchBar {...defaultProps} onSearch={mockOnSearch} query="is:unresolved" />
      );

      expect(screen.getByRole('textbox')).toHaveValue('is:unresolved ');

      userEvent.click(screen.getByRole('button', {name: 'Clear search'}));

      expect(screen.getByRole('textbox')).toHaveValue('');

      expect(mockOnSearch).toHaveBeenCalledTimes(1);
      expect(mockOnSearch).toHaveBeenCalledWith('');
    });
  });

  describe('dropdown open state', function () {
    it('opens the dropdown when the search box is clicked', function () {
      render(<SmartSearchBar {...defaultProps} />);

      const textbox = screen.getByRole('textbox');

      userEvent.click(textbox);

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
    });

    it('opens the dropdown when the search box gains focus', function () {
      render(<SmartSearchBar {...defaultProps} />);

      const textbox = screen.getByRole('textbox');

      fireEvent.focus(textbox);

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
    });

    it('hides the drop down when clicking outside', function () {
      render(
        <div data-test-id="test-container">
          <SmartSearchBar {...defaultProps} />
        </div>
      );

      const textbox = screen.getByRole('textbox');

      // Open the dropdown
      fireEvent.focus(textbox);

      userEvent.click(screen.getByTestId('test-container'));

      expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
    });

    it('hides the drop down when pressing escape', function () {
      render(<SmartSearchBar {...defaultProps} />);

      const textbox = screen.getByRole('textbox');

      // Open the dropdown
      fireEvent.focus(textbox);

      userEvent.type(textbox, '{Escape}');

      expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('pasting', function () {
    it('trims pasted content', function () {
      const mockOnChange = jest.fn();
      render(<SmartSearchBar {...defaultProps} onChange={mockOnChange} />);

      const textbox = screen.getByRole('textbox');

      fireEvent.paste(textbox, {clipboardData: {getData: () => ' something'}});

      expect(textbox).toHaveValue('something');
      expect(mockOnChange).toHaveBeenCalledWith('something', expect.anything());
    });
  });

  it('invokes onSearch() on enter', function () {
    const mockOnSearch = jest.fn();
    render(<SmartSearchBar {...defaultProps} query="test" onSearch={mockOnSearch} />);

    userEvent.type(screen.getByRole('textbox'), '{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('test');
  });

  it('handles an empty query', function () {
    render(<SmartSearchBar {...defaultProps} query="" />);

    expect(screen.getByRole('textbox')).toHaveValue('');
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
      mockCursorPosition(searchBar, 'event.type:error '.length);
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

  describe('date fields', () => {
    const props = {
      query: '',
      organization,
      location,
      supportedTags,
    };

    it('displays date picker dropdown when appropriate', () => {
      render(<SmartSearchBar {...props} />);

      const textbox = screen.getByRole('textbox');
      userEvent.click(textbox);
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();

      // Just lastSeen: will display relative and absolute options, not the datepicker
      userEvent.type(textbox, 'lastSeen:');
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();
      expect(screen.getByText('Last hour')).toBeInTheDocument();
      expect(screen.getByText('After a custom datetime')).toBeInTheDocument();

      // lastSeen:> should open the date picker
      userEvent.type(textbox, '>');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // Continues to display with date typed out
      userEvent.type(textbox, '2022-01-01');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // Goes away when on next term
      userEvent.type(textbox, ' ');
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();

      // Pops back up when cursor is back in date token
      userEvent.keyboard('{arrowleft}');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // Moving cursor inside the `lastSeen` token hides the date picker
      textbox.setSelectionRange(1, 1);
      userEvent.click(textbox);
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();
    });

    it('can select a suggested relative time value', () => {
      render(<SmartSearchBar {...props} />);

      userEvent.type(screen.getByRole('textbox'), 'lastSeen:');

      userEvent.click(screen.getByText('Last hour'));

      expect(screen.getByRole('textbox')).toHaveValue('lastSeen:-1h ');
    });

    it('can select a specific date/time', async () => {
      render(<SmartSearchBar {...props} />);

      userEvent.type(screen.getByRole('textbox'), 'lastSeen:');

      userEvent.click(screen.getByText('After a custom datetime'));

      // Should have added '>' to query and show a date picker
      expect(screen.getByRole('textbox')).toHaveValue('lastSeen:>');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // For whatever reason, need this line to get the lazily-loaded datepicker
      // to show up in this test. Without it, the datepicker never shows up
      // no matter how long the timeout is set to.
      await tick();

      // Select a day on the calendar
      const dateInput = await screen.findByTestId('date-picker');
      fireEvent.change(dateInput, {target: {value: '2022-01-02'}});

      expect(screen.getByRole('textbox')).toHaveValue(
        // -05:00 because our tests run in EST
        'lastSeen:>2022-01-02T00:00:00-05:00'
      );

      const timeInput = screen.getByLabelText('Time');

      // Simulate changing time input one bit at a time
      userEvent.click(timeInput);
      fireEvent.change(timeInput, {target: {value: '01:00:00'}});
      fireEvent.change(timeInput, {target: {value: '01:02:00'}});
      fireEvent.change(timeInput, {target: {value: '01:02:03'}});
      // Time input should have retained focus this whole time
      expect(timeInput).toHaveFocus();
      fireEvent.blur(timeInput);

      expect(screen.getByRole('textbox')).toHaveValue(
        'lastSeen:>2022-01-02T01:02:03-05:00'
      );

      // Toggle UTC on, which should remove the timezone (-05:00) from the query
      userEvent.click(screen.getByLabelText('Use UTC'));
      expect(screen.getByRole('textbox')).toHaveValue('lastSeen:>2022-01-02T01:02:03');
    });

    it('can change an existing datetime', async () => {
      render(<SmartSearchBar {...props} />);

      const textbox = screen.getByRole('textbox');
      fireEvent.change(textbox, {
        target: {value: 'lastSeen:2022-01-02 firstSeen:2022-01-01'},
      });

      // Move cursor to the lastSeen date
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

      await tick();
      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-02');
      expect(screen.getByLabelText('Time')).toHaveValue('00:00:00');
      expect(screen.getByLabelText('Use UTC')).toBeChecked();

      fireEvent.change(dateInput, {target: {value: '2022-01-03'}});

      expect(textbox).toHaveValue('lastSeen:2022-01-03T00:00:00 firstSeen:2022-01-01');

      // Cursor should be at end of the value we just replaced
      expect(textbox.selectionStart).toBe('lastSeen:2022-01-03T00:00:00'.length);
    });

    it('populates the date picker correctly for date without time', async () => {
      render(<SmartSearchBar {...props} query="lastSeen:2022-01-01" />);

      const textbox = screen.getByRole('textbox');
      // Move cursor to the timestamp
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

      userEvent.click(screen.getByRole('textbox'));

      await tick();
      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      // No time provided, so time input should be the default value
      expect(screen.getByLabelText('Time')).toHaveValue('00:00:00');
      // UTC is checked because there is no timezone
      expect(screen.getByLabelText('Use UTC')).toBeChecked();
    });

    it('populates the date picker correctly for date with time and no timezone', async () => {
      render(<SmartSearchBar {...props} query="lastSeen:2022-01-01T09:45:12" />);

      const textbox = screen.getByRole('textbox');
      // Move cursor to the timestamp
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

      await tick();
      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      expect(screen.getByLabelText('Time')).toHaveValue('09:45:12');
      expect(screen.getByLabelText('Use UTC')).toBeChecked();
    });

    it('populates the date picker correctly for date with time and timezone', async () => {
      render(<SmartSearchBar {...props} query="lastSeen:2022-01-01T09:45:12-05:00" />);

      const textbox = screen.getByRole('textbox');
      // Move cursor to the timestamp
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

      await tick();
      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      expect(screen.getByLabelText('Time')).toHaveValue('09:45:12');
      expect(screen.getByLabelText('Use UTC')).not.toBeChecked();
    });
  });
});
