import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';

import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {DeprecatedSmartSearchBar} from 'sentry/components/deprecatedSmartSearchBar';
import TagStore from 'sentry/stores/tagStore';
import {FieldKey} from 'sentry/utils/fields';

import {ItemType} from './types';

describe('SmartSearchBar', function () {
  let defaultProps;

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess([
      ...TagsFixture(),
      {
        key: 'firstRelease',
        name: 'firstRelease',
      },
      {
        key: 'is',
        name: 'is',
      },
    ]);
    const supportedTags = TagStore.getState();

    const organization = OrganizationFixture({id: '123'});

    const location = {
      pathname: '/organizations/org-slug/recent-searches/',
      query: {
        projectId: '0',
      },
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
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

    render(
      <DeprecatedSmartSearchBar {...defaultProps} onGetTagValues={onGetTagValuesMock} />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.click(textbox);
    await userEvent.type(textbox, 'device:this');

    const option = await screen.findByText(/this is filled with spaces/);

    await userEvent.click(option);

    expect(textbox).toHaveValue('device:"this is filled with spaces" ');
  });

  it('escapes quotes in values properly when autocompleting', async function () {
    const onGetTagValuesMock = jest
      .fn()
      .mockResolvedValue(['this " is " filled " with " quotes']);

    render(
      <DeprecatedSmartSearchBar {...defaultProps} onGetTagValues={onGetTagValuesMock} />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.click(textbox);
    await userEvent.type(textbox, 'device:this');

    const option = await screen.findByText(/this \\" is \\" filled \\" with \\" quotes/);

    await userEvent.click(option);

    expect(textbox).toHaveValue('device:"this \\" is \\" filled \\" with \\" quotes" ');
  });

  it('does not search when pressing enter on a tag without a value', async function () {
    const onSearchMock = jest.fn();

    render(<DeprecatedSmartSearchBar {...defaultProps} onSearch={onSearchMock} />);

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'browser:{enter}');

    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('autocompletes value with tab', async function () {
    const onSearchMock = jest.fn();

    render(<DeprecatedSmartSearchBar {...defaultProps} onSearch={onSearchMock} />);

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'bro');

    expect(
      await screen.findByRole('option', {name: 'bro wser - field'})
    ).toBeInTheDocument();

    // down once to 'browser' dropdown item
    await userEvent.keyboard('{ArrowDown}{Tab}');

    await waitFor(() => {
      expect(textbox).toHaveValue('browser:');
    });

    expect(textbox).toHaveFocus();

    // Should not have executed the search
    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('autocompletes value with enter', async function () {
    const onSearchMock = jest.fn();

    render(<DeprecatedSmartSearchBar {...defaultProps} onSearch={onSearchMock} />);

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'bro');

    expect(
      await screen.findByRole('option', {name: 'bro wser - field'})
    ).toBeInTheDocument();

    // down once to 'browser' dropdown item
    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(textbox).toHaveValue('browser:');
    });

    expect(textbox).toHaveFocus();

    // Should not have executed the search
    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('searches and completes tags with negation operator', async function () {
    render(<DeprecatedSmartSearchBar {...defaultProps} />);

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, '!bro');

    const field = await screen.findByRole('option', {name: 'bro wser - field'});

    await userEvent.click(field);

    expect(textbox).toHaveValue('!browser:');
  });

  describe('componentWillReceiveProps()', function () {
    it('should add a space when setting query', function () {
      render(<DeprecatedSmartSearchBar {...defaultProps} query="one" />);

      expect(screen.getByRole('textbox')).toHaveValue('one ');
    });

    it('updates query when prop changes', function () {
      const {rerender} = render(
        <DeprecatedSmartSearchBar {...defaultProps} query="one" />
      );

      rerender(<DeprecatedSmartSearchBar {...defaultProps} query="two" />);

      expect(screen.getByRole('textbox')).toHaveValue('two ');
    });

    it('updates query when prop set to falsey value', function () {
      const {rerender} = render(
        <DeprecatedSmartSearchBar {...defaultProps} query="one" />
      );

      rerender(<DeprecatedSmartSearchBar {...defaultProps} query={null} />);

      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('should not reset user textarea if a noop props change happens', async function () {
      const {rerender} = render(
        <DeprecatedSmartSearchBar {...defaultProps} query="one" />
      );

      await userEvent.type(screen.getByRole('textbox'), 'two');

      rerender(<DeprecatedSmartSearchBar {...defaultProps} query="one" />);

      expect(screen.getByRole('textbox')).toHaveValue('one two');
    });

    it('should reset user textarea if a meaningful props change happens', async function () {
      const {rerender} = render(
        <DeprecatedSmartSearchBar {...defaultProps} query="one" />
      );

      await userEvent.type(screen.getByRole('textbox'), 'two');

      rerender(<DeprecatedSmartSearchBar {...defaultProps} query="blah" />);

      expect(screen.getByRole('textbox')).toHaveValue('blah ');
    });
  });

  describe('clear search', function () {
    it('clicking the clear search button clears the query and calls onSearch', async function () {
      const mockOnSearch = jest.fn();

      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          onSearch={mockOnSearch}
          query="is:unresolved"
        />
      );

      expect(screen.getByRole('textbox')).toHaveValue('is:unresolved ');

      await userEvent.click(screen.getByRole('button', {name: 'Clear search'}));

      expect(screen.getByRole('textbox')).toHaveValue('');

      expect(mockOnSearch).toHaveBeenCalledTimes(1);
      expect(mockOnSearch).toHaveBeenCalledWith('');
    });
  });

  describe('dropdown open state', function () {
    it('opens the dropdown when the search box is clicked', async function () {
      render(<DeprecatedSmartSearchBar {...defaultProps} />);

      const textbox = screen.getByRole('textbox');

      await userEvent.click(textbox);

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
    });

    it('opens the dropdown when the search box gains focus', function () {
      render(<DeprecatedSmartSearchBar {...defaultProps} />);

      const textbox = screen.getByRole('textbox');

      fireEvent.focus(textbox);

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
    });

    it('hides the drop down when clicking outside', async function () {
      render(
        <div data-test-id="test-container">
          <DeprecatedSmartSearchBar {...defaultProps} />
        </div>
      );

      const textbox = screen.getByRole('textbox');

      // Open the dropdown
      fireEvent.focus(textbox);

      await userEvent.click(screen.getByTestId('test-container'));

      expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
    });

    it('hides the drop down when pressing escape', async function () {
      render(<DeprecatedSmartSearchBar {...defaultProps} />);

      const textbox = screen.getByRole('textbox');

      // Open the dropdown
      fireEvent.focus(textbox);

      await userEvent.type(textbox, '{Escape}');

      expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('pasting', function () {
    it('trims pasted content', async function () {
      const mockOnChange = jest.fn();
      render(<DeprecatedSmartSearchBar {...defaultProps} onChange={mockOnChange} />);

      const textbox = screen.getByRole('textbox');

      fireEvent.paste(textbox, {clipboardData: {getData: () => ' something'}});

      expect(textbox).toHaveValue('something');
      await waitFor(() =>
        expect(mockOnChange).toHaveBeenCalledWith('something', expect.anything())
      );
    });
  });

  it('invokes onSearch() on enter', async function () {
    const mockOnSearch = jest.fn();
    render(
      <DeprecatedSmartSearchBar {...defaultProps} query="test" onSearch={mockOnSearch} />
    );

    await userEvent.type(screen.getByRole('textbox'), '{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('test');
  });

  it('handles an empty query', function () {
    render(<DeprecatedSmartSearchBar {...defaultProps} query="" />);

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('does not fetch tag values with environment tag and excludeEnvironment', async function () {
    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'environment:');

    expect(getTagValuesMock).not.toHaveBeenCalled();
  });

  it('does not fetch tag values with timesSeen tag', async function () {
    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'timesSeen:');

    expect(getTagValuesMock).not.toHaveBeenCalled();
  });

  it('fetches and displays tag values with other tags', async function () {
    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'browser:');

    expect(getTagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('shows correct options on cursor changes for keys and values', async function () {
    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        query="is:unresolved"
        onGetTagValues={getTagValuesMock}
        onGetRecentSearches={jest.fn().mockReturnValue([])}
      />
    );

    const textbox = screen.getByRole<HTMLTextAreaElement>('textbox');

    // Set cursor to beginning of "is" tag
    await userEvent.click(textbox);
    textbox.setSelectionRange(0, 0);

    // Should show "Keys" section
    expect(await screen.findByText('Keys')).toBeInTheDocument();

    // Set cursor to middle of "is" tag
    await userEvent.keyboard('{ArrowRight}');
    // Should show "Keys" and NOT "Operator Helpers" or "Values"
    expect(await screen.findByText('Keys')).toBeInTheDocument();
    expect(screen.queryByText('Operator Helpers')).not.toBeInTheDocument();
    expect(screen.queryByText('Values')).not.toBeInTheDocument();

    // Set cursor to end of "is" tag
    await userEvent.keyboard('{ArrowRight}');
    // Should show "Tags" and "Operator Helpers" but NOT "Values"
    expect(await screen.findByText('Keys')).toBeInTheDocument();
    expect(screen.getByText('Operator Helpers')).toBeInTheDocument();
    expect(screen.queryByText('Values')).not.toBeInTheDocument();

    // Set cursor after the ":"
    await userEvent.keyboard('{ArrowRight}');
    // Should show "Values" and "Operator Helpers" but NOT "Keys"
    expect(await screen.findByText('Values')).toBeInTheDocument();
    expect(await screen.findByText('Operator Helpers')).toBeInTheDocument();
    expect(screen.queryByText('Keys')).not.toBeInTheDocument();

    // Set cursor inside value
    await userEvent.keyboard('{ArrowRight}');
    // Should show "Values" and NOT "Operator Helpers" or "Keys"
    expect(await screen.findByText('Values')).toBeInTheDocument();
    expect(screen.queryByText('Operator Helpers')).not.toBeInTheDocument();
    expect(screen.queryByText('Keys')).not.toBeInTheDocument();
  });

  it('shows syntax error for incorrect tokens', function () {
    render(<DeprecatedSmartSearchBar {...defaultProps} query="tag: is: has:" />);

    // Should have three invalid tokens (tag:, is:, and has:)
    expect(screen.getAllByTestId('filter-token-invalid')).toHaveLength(3);
  });

  it('renders nested keys correctly', async function () {
    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        query=""
        supportedTags={{
          nested: {
            key: 'nested',
            name: 'nested',
          },
          'nested.child': {
            key: 'nested.child',
            name: 'nested.child',
          },
          'nestednoparent.child': {
            key: 'nestednoparent.child',
            name: 'nestednoparent.child',
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'nest');

    await screen.findByText('Keys');
  });

  it('filters keys on name and description', async function () {
    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        query=""
        supportedTags={{
          [FieldKey.DEVICE_CHARGING]: {
            key: FieldKey.DEVICE_CHARGING,
          },
          [FieldKey.EVENT_TYPE]: {
            key: FieldKey.EVENT_TYPE,
          },
          [FieldKey.DEVICE_ARCH]: {
            key: FieldKey.DEVICE_ARCH,
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'event');

    await screen.findByText('Keys');

    // Should show event.type (has event in key) and device.charging (has event in description)
    expect(screen.getByRole('option', {name: /event . type/})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /charging/})).toBeInTheDocument();

    // But not device.arch (not in key or description)
    expect(screen.queryByRole('option', {name: /arch/})).not.toBeInTheDocument();
  });

  it('handles autocomplete race conditions when cursor position changed', async function () {
    jest.useFakeTimers();
    const user = userEvent.setup({delay: null});

    const mockOnGetTagValues = jest.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve(['value']);
          }, 300);
        })
    );

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        onGetTagValues={mockOnGetTagValues}
        query=""
      />
    );

    const textbox = screen.getByRole('textbox');

    // Type key and start searching values
    await user.type(textbox, 'is:');

    act(() => jest.advanceTimersByTime(200));

    // Before values have finished searching, clear the textbox
    await user.clear(textbox);

    act(jest.runAllTimers);

    // Should show keys, not values in dropdown
    expect(await screen.findByText('Keys')).toBeInTheDocument();
    expect(screen.queryByText('Values')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('autocompletes tag values', async function () {
    const mockOnChange = jest.fn();

    const getTagValuesMock = jest.fn().mockResolvedValue(['Chrome', 'Firefox']);

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        query=""
        onChange={mockOnChange}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'browser:');

    const option = await screen.findByRole('option', {name: /Firefox/});

    await userEvent.click(option, {delay: null});

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'browser:Firefox ',
        expect.anything()
      );
    });
  });

  it('autocompletes tag values when there are other tags', async function () {
    const mockOnChange = jest.fn();

    const getTagValuesMock = jest.fn().mockResolvedValue(['Chrome', 'Firefox']);

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
        query="is:unresolved browser: error.handled:true"
        onChange={mockOnChange}
      />
    );

    const textbox = screen.getByRole('textbox');

    await userEvent.type(textbox, '{ArrowRight}', {
      initialSelectionStart: 'is:unresolved browser'.length,
      initialSelectionEnd: 'is:unresolved browser'.length,
    });

    const option = await screen.findByRole('option', {name: /Firefox/});

    await userEvent.click(option, {delay: null});

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'is:unresolved browser:Firefox error.handled:true ',
        expect.anything()
      );
    });
  });

  it('autocompletes tag values (user tag)', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();
    const getTagValuesMock = jest.fn().mockResolvedValue(['id:1']);

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        query=""
        onChange={mockOnChange}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'user:', {delay: null});

    act(jest.runOnlyPendingTimers);

    const option = await screen.findByRole('option', {name: /id:1/});

    await userEvent.click(option, {delay: null});

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith('user:"id:1" ', expect.anything());
    });
    jest.useRealTimers();
  });

  it('autocompletes assigned from string values', async function () {
    const mockOnChange = jest.fn();

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        query=""
        onChange={mockOnChange}
        supportedTags={{
          assigned: {
            key: 'assigned',
            name: 'assigned',
            predefined: true,
            values: ['me', '[me, none]', '#team-a'],
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'assigned:', {delay: null});

    await userEvent.click(await screen.findByRole('option', {name: /#team-a/}), {
      delay: null,
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'assigned:#team-a ',
        expect.anything()
      );
    });
  });

  it('autocompletes assigned from SearchGroup objects', async function () {
    const mockOnChange = jest.fn();

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        query=""
        onChange={mockOnChange}
        supportedTags={{
          assigned: {
            key: 'assigned',
            name: 'assigned',
            predefined: true,
            values: [
              {
                title: 'Suggested Values',
                type: 'header',
                icon: <Fragment />,
                children: [
                  {
                    value: 'me',
                    desc: 'me',
                    type: ItemType.TAG_VALUE,
                  },
                ],
              },
              {
                title: 'All Values',
                type: 'header',
                icon: <Fragment />,
                children: [
                  {
                    value: '#team-a',
                    desc: '#team-a',
                    type: ItemType.TAG_VALUE,
                  },
                ],
              },
            ],
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'assigned:', {delay: null});

    expect(await screen.findByText('Suggested Values')).toBeInTheDocument();
    expect(screen.getByText('All Values')).toBeInTheDocument();

    // Filter down to "team"
    await userEvent.type(textbox, 'team', {delay: null});

    expect(screen.queryByText('Suggested Values')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('option', {name: /#team-a/}), {delay: null});

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'assigned:#team-a ',
        expect.anything()
      );
    });
  });

  it('autocompletes tag values (predefined values with spaces)', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        query=""
        onChange={mockOnChange}
        supportedTags={{
          predefined: {
            key: 'predefined',
            name: 'predefined',
            predefined: true,
            values: ['predefined tag with spaces'],
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'predefined:', {delay: null});

    act(jest.runOnlyPendingTimers);

    const option = await screen.findByRole('option', {
      name: /predefined tag with spaces/,
    });

    await userEvent.click(option, {delay: null});

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'predefined:"predefined tag with spaces" ',
        expect.anything()
      );
    });

    jest.useRealTimers();
  });

  it('autocompletes tag values (predefined values with quotes)', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();

    render(
      <DeprecatedSmartSearchBar
        {...defaultProps}
        query=""
        onChange={mockOnChange}
        supportedTags={{
          predefined: {
            key: 'predefined',
            name: 'predefined',
            predefined: true,
            values: ['"predefined" "tag" "with" "quotes"'],
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'predefined:', {delay: null});

    act(jest.runOnlyPendingTimers);

    const option = await screen.findByRole('option', {
      name: /quotes/,
    });

    await userEvent.click(option, {delay: null});

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'predefined:"\\"predefined\\" \\"tag\\" \\"with\\" \\"quotes\\"" ',
        expect.anything()
      );
    });

    jest.useRealTimers();
  });

  describe('quick actions', function () {
    it('can delete tokens', async function () {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          query="is:unresolved sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');

      // Put cursor inside is:resolved
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 0,
        initialSelectionEnd: 0,
      });

      await userEvent.click(screen.getByRole('button', {name: /Delete/}));

      expect(textbox).toHaveValue('sdk.name:sentry-cocoa has:key');
    });

    it('can delete a middle token', async function () {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          query="is:unresolved sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');

      // Put cursor inside sdk.name
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 'is:unresolved '.length,
        initialSelectionEnd: 'is:unresolved '.length,
      });

      await userEvent.click(screen.getByRole('button', {name: /Delete/}));

      expect(textbox).toHaveValue('is:unresolved has:key');
    });

    it('can exclude a token', async function () {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          query="is:unresolved sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');

      // Put cursor inside sdk.name
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 'is:unresolved '.length,
        initialSelectionEnd: 'is:unresolved '.length,
      });

      await userEvent.click(screen.getByRole('button', {name: /Exclude/}));

      expect(textbox).toHaveValue('is:unresolved !sdk.name:sentry-cocoa has:key ');
    });

    it('can include a token', async function () {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          query="is:unresolved !sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');

      // Put cursor inside sdk.name
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 'is:unresolved !'.length,
        initialSelectionEnd: 'is:unresolved !'.length,
      });

      expect(textbox).toHaveValue('is:unresolved !sdk.name:sentry-cocoa has:key ');

      await screen.findByRole('button', {name: /Include/});
      await userEvent.click(screen.getByRole('button', {name: /Include/}));

      expect(textbox).toHaveValue('is:unresolved sdk.name:sentry-cocoa has:key ');
    });
  });

  it('displays invalid field message', async function () {
    render(<DeprecatedSmartSearchBar {...defaultProps} query="" />);

    const textbox = screen.getByRole('textbox');

    await userEvent.type(textbox, 'invalid:');

    expect(
      await screen.findByRole('option', {name: /the field invalid isn't supported here/i})
    ).toBeInTheDocument();
  });

  it('displays invalid field messages for when wildcard is disallowed', async function () {
    render(<DeprecatedSmartSearchBar {...defaultProps} query="" disallowWildcard />);

    const textbox = screen.getByRole('textbox');

    // Value
    await userEvent.type(textbox, 'release:*');
    expect(
      await screen.findByRole('option', {name: /Wildcards aren't supported here/i})
    ).toBeInTheDocument();
    await userEvent.clear(textbox);

    // FreeText
    await userEvent.type(textbox, 'rel*ease');
    expect(
      await screen.findByRole('option', {name: /Wildcards aren't supported here/i})
    ).toBeInTheDocument();
  });

  describe('date fields', () => {
    // Transpile the lazy-loaded datepicker up front so tests don't flake
    beforeAll(async function () {
      await import('sentry/components/calendar/datePicker');
    });

    it('displays date picker dropdown when appropriate', async () => {
      render(<DeprecatedSmartSearchBar {...defaultProps} query="" />);

      const textbox = screen.getByRole<HTMLTextAreaElement>('textbox');
      await userEvent.click(textbox);
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();

      // Just lastSeen: will display relative and absolute options, not the datepicker
      await userEvent.type(textbox, 'lastSeen:');
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();
      expect(screen.getByText('Last hour')).toBeInTheDocument();
      expect(screen.getByText('After a custom datetime')).toBeInTheDocument();

      // lastSeen:> should open the date picker
      await userEvent.type(textbox, '>');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // Continues to display with date typed out
      await userEvent.type(textbox, '2022-01-01');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // Goes away when on next term
      await userEvent.type(textbox, ' ');
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();

      // Pops back up when cursor is back in date token
      await userEvent.keyboard('{arrowleft}');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // Moving cursor inside the `lastSeen` token hides the date picker
      textbox.setSelectionRange(1, 1);
      await userEvent.click(textbox);
      expect(screen.queryByTestId('search-bar-date-picker')).not.toBeInTheDocument();
    });

    it('can select a suggested relative time value', async () => {
      render(<DeprecatedSmartSearchBar {...defaultProps} query="" />);

      await userEvent.type(screen.getByRole('textbox'), 'lastSeen:');

      await userEvent.click(screen.getByText('Last hour'));

      expect(screen.getByRole('textbox')).toHaveValue('lastSeen:-1h ');
    });

    it('can select a specific date/time', async () => {
      render(<DeprecatedSmartSearchBar {...defaultProps} query="" />);

      await userEvent.type(screen.getByRole('textbox'), 'lastSeen:');

      await userEvent.click(screen.getByText('After a custom datetime'));

      // Should have added '>' to query and show a date picker
      expect(screen.getByRole('textbox')).toHaveValue('lastSeen:>');
      expect(screen.getByTestId('search-bar-date-picker')).toBeInTheDocument();

      // Select a day on the calendar
      const dateInput = await screen.findByTestId('date-picker');
      fireEvent.change(dateInput, {target: {value: '2022-01-02'}});

      expect(screen.getByRole('textbox')).toHaveValue(
        // -05:00 because our tests run in EST
        'lastSeen:>2022-01-02T00:00:00-05:00'
      );

      const timeInput = screen.getByLabelText('Time');

      // Simulate changing time input one bit at a time
      await userEvent.click(timeInput);
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
      await userEvent.click(screen.getByLabelText('Use UTC'));
      expect(screen.getByRole('textbox')).toHaveValue('lastSeen:>2022-01-02T01:02:03');
    });

    it('can change an existing datetime', async () => {
      render(<DeprecatedSmartSearchBar {...defaultProps} query="" />);

      const textbox = screen.getByRole<HTMLTextAreaElement>('textbox');
      fireEvent.change(textbox, {
        target: {value: 'lastSeen:2022-01-02 firstSeen:2022-01-01'},
      });

      // Move cursor to the lastSeen date
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 'lastSeen:2022-01-0'.length,
        initialSelectionEnd: 'lastSeen:2022-01-0'.length,
      });

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
      render(<DeprecatedSmartSearchBar {...defaultProps} query="lastSeen:2022-01-01" />);

      const textbox = screen.getByRole('textbox');

      // Move cursor to the timestamp
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 'lastSeen:2022-01-0'.length,
        initialSelectionEnd: 'lastSeen:2022-01-0'.length,
      });

      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      // No time provided, so time input should be the default value
      expect(screen.getByLabelText('Time')).toHaveValue('00:00:00');
      // UTC is checked because there is no timezone
      expect(screen.getByLabelText('Use UTC')).toBeChecked();
    });

    it('populates the date picker correctly for date with time and no timezone', async () => {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          query="lastSeen:2022-01-01T09:45:12"
        />
      );

      const textbox = screen.getByRole('textbox');

      // Move cursor to the timestamp
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 'lastSeen:2022-01-0'.length,
        initialSelectionEnd: 'lastSeen:2022-01-0'.length,
      });

      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      expect(screen.getByLabelText('Time')).toHaveValue('09:45:12');
      expect(screen.getByLabelText('Use UTC')).toBeChecked();
    });

    it('populates the date picker correctly for date with time and timezone', async () => {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          query="lastSeen:2022-01-01T09:45:12-05:00"
        />
      );

      const textbox = screen.getByRole('textbox');

      // Move cursor to the timestamp
      await userEvent.type(textbox, '{ArrowRight}', {
        initialSelectionStart: 'lastSeen:2022-01-0'.length,
        initialSelectionEnd: 'lastSeen:2022-01-0'.length,
      });

      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      expect(screen.getByLabelText('Time')).toHaveValue('09:45:12');
      expect(screen.getByLabelText('Use UTC')).not.toBeChecked();
    });
  });

  describe('defaultSearchGroup', () => {
    const defaultSearchGroup = {
      title: 'default search group',
      type: 'header',
      // childrenWrapper allows us to arrange the children with custom styles
      childrenWrapper: props => (
        <div data-test-id="default-search-group-wrapper" {...props} />
      ),
      children: [
        {
          type: ItemType.RECOMMENDED,
          title: 'Assignee',
          value: 'assigned_or_suggested:',
        },
      ],
    };

    it('displays a default group with custom wrapper', async function () {
      const mockOnChange = jest.fn();
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          defaultSearchGroup={defaultSearchGroup}
          query=""
          onChange={mockOnChange}
        />
      );

      const textbox = screen.getByRole('textbox');
      await userEvent.click(textbox);

      expect(screen.getByTestId('default-search-group-wrapper')).toBeInTheDocument();
      expect(screen.getByText('default search group')).toBeInTheDocument();

      // Default group is correctly added to the dropdown
      await userEvent.keyboard('{ArrowDown}{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith(
        'assigned_or_suggested:',
        expect.anything()
      );
    });
    it('hides the default group after typing', async function () {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          defaultSearchGroup={defaultSearchGroup}
        />
      );

      const textbox = screen.getByRole('textbox');
      await userEvent.click(textbox);

      expect(screen.getByTestId('default-search-group-wrapper')).toBeInTheDocument();

      await userEvent.type(textbox, 'f');

      expect(
        screen.queryByTestId('default-search-group-wrapper')
      ).not.toBeInTheDocument();
    });

    it('hides the default group after picking item with applyFilter', async function () {
      render(
        <DeprecatedSmartSearchBar
          {...defaultProps}
          defaultSearchGroup={{
            ...defaultSearchGroup,
            children: [
              {
                type: ItemType.RECOMMENDED,
                title: 'Custom Tags',
                // Filter is applied to all search items when picked
                applyFilter: item => item.title === 'device',
              },
            ],
          }}
        />
      );

      const textbox = screen.getByRole('textbox');
      await userEvent.click(textbox);
      expect(await screen.findByText('User identification value')).toBeInTheDocument();
      await userEvent.click(screen.getByText('Custom Tags'));

      expect(screen.queryByText('Custom Tags')).not.toBeInTheDocument();
      expect(screen.queryByText('User identification value')).not.toBeInTheDocument();
      expect(screen.getByText('device')).toBeInTheDocument();
    });
  });
});
