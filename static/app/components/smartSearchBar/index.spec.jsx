import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {SmartSearchBar} from 'sentry/components/smartSearchBar';
import TagStore from 'sentry/stores/tagStore';
import {FieldKey} from 'sentry/utils/fields';

describe('SmartSearchBar', function () {
  let defaultProps;

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TestStubs.Tags());
    const supportedTags = TagStore.getState();
    supportedTags.firstRelease = {
      key: 'firstRelease',
      name: 'firstRelease',
    };
    supportedTags.is = {
      key: 'is',
      name: 'is',
    };

    const organization = TestStubs.Organization({id: '123'});

    const location = {
      pathname: '/organizations/org-slug/recent-searches/',
      query: {
        projectId: '0',
      },
    };

    MockApiClient.clearMockResponses();
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

    expect(
      await screen.findByRole('option', {name: 'bro wser - field'})
    ).toBeInTheDocument();

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

    expect(
      await screen.findByRole('option', {name: 'bro wser - field'})
    ).toBeInTheDocument();

    // down once to 'browser' dropdown item
    userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(textbox).toHaveValue('browser:');
    });

    expect(textbox).toHaveFocus();

    // Should not have executed the search
    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('searches and completes tags with negation operator', async function () {
    render(<SmartSearchBar {...defaultProps} />);

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, '!bro');

    const field = await screen.findByRole('option', {name: 'bro wser - field'});

    userEvent.click(field);

    expect(textbox).toHaveValue('!browser:');
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

  it('does not fetch tag values with environment tag and excludeEnvironment', function () {
    jest.useFakeTimers('modern');

    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <SmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
      />
    );

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'environment:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(getTagValuesMock).not.toHaveBeenCalled();
  });

  it('does not fetch tag values with timesSeen tag', function () {
    jest.useFakeTimers('modern');

    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <SmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
      />
    );

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'timesSeen:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(getTagValuesMock).not.toHaveBeenCalled();
  });

  it('fetches and displays tag values with other tags', function () {
    jest.useFakeTimers();

    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <SmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
      />
    );

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'browser:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(getTagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('shows correct options on cursor changes for keys and values', async function () {
    jest.useFakeTimers();

    const getTagValuesMock = jest.fn().mockResolvedValue([]);

    render(
      <SmartSearchBar
        {...defaultProps}
        query="is:unresolved"
        onGetTagValues={getTagValuesMock}
        onGetRecentSearches={jest.fn().mockReturnValue([])}
      />
    );

    const textbox = screen.getByRole('textbox');

    // Set cursor to beginning of "is" tag
    textbox.setSelectionRange(0, 0);
    userEvent.click(textbox);
    act(() => {
      jest.runAllTimers();
    });
    // Should show "Keys" section
    expect(await screen.findByText('Keys')).toBeInTheDocument();

    // Set cursor to middle of "is" tag
    userEvent.keyboard('{ArrowRight}');
    act(() => {
      jest.runAllTimers();
    });
    // Should show "Keys" and NOT "Operator Helpers" or "Values"
    expect(await screen.findByText('Keys')).toBeInTheDocument();
    expect(screen.queryByText('Operator Helpers')).not.toBeInTheDocument();
    expect(screen.queryByText('Values')).not.toBeInTheDocument();

    // Set cursor to end of "is" tag
    userEvent.keyboard('{ArrowRight}');
    act(() => {
      jest.runAllTimers();
    });
    // Should show "Tags" and "Operator Helpers" but NOT "Values"
    expect(await screen.findByText('Keys')).toBeInTheDocument();
    expect(screen.getByText('Operator Helpers')).toBeInTheDocument();
    expect(screen.queryByText('Values')).not.toBeInTheDocument();

    // Set cursor after the ":"
    userEvent.keyboard('{ArrowRight}');
    act(() => {
      jest.runAllTimers();
    });
    // Should show "Values" and "Operator Helpers" but NOT "Keys"
    expect(await screen.findByText('Values')).toBeInTheDocument();
    expect(await screen.findByText('Operator Helpers')).toBeInTheDocument();
    expect(screen.queryByText('Keys')).not.toBeInTheDocument();

    // Set cursor inside value
    userEvent.keyboard('{ArrowRight}');
    act(() => {
      jest.runAllTimers();
    });
    // Should show "Values" and NOT "Operator Helpers" or "Keys"
    expect(await screen.findByText('Values')).toBeInTheDocument();
    expect(screen.queryByText('Operator Helpers')).not.toBeInTheDocument();
    expect(screen.queryByText('Keys')).not.toBeInTheDocument();
  });

  it('shows syntax error for incorrect tokens', function () {
    render(<SmartSearchBar {...defaultProps} query="tag: is: has:" />);

    // Should have three invalid tokens (tag:, is:, and has:)
    expect(screen.getAllByTestId('filter-token-invalid')).toHaveLength(3);
  });

  it('renders nested keys correctly', async function () {
    const {container} = render(
      <SmartSearchBar
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
    userEvent.type(textbox, 'nest');

    await screen.findByText('Keys');

    expect(container).toSnapshot();
  });

  it('filters keys on name and description', async function () {
    render(
      <SmartSearchBar
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
    userEvent.type(textbox, 'event');

    await screen.findByText('Keys');

    // Should show event.type (has event in key) and device.charging (has event in description)
    expect(screen.getByRole('option', {name: /event . type/})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /charging/})).toBeInTheDocument();

    // But not device.arch (not in key or description)
    expect(screen.queryByRole('option', {name: /arch/})).not.toBeInTheDocument();
  });

  it('handles autocomplete race conditions when cursor position changed', async function () {
    jest.useFakeTimers();
    const mockOnGetTagValues = jest.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve(['value']);
          }, [300]);
        })
    );

    render(
      <SmartSearchBar {...defaultProps} onGetTagValues={mockOnGetTagValues} query="" />
    );

    const textbox = screen.getByRole('textbox');

    // Type key and start searching values
    userEvent.type(textbox, 'is:');

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Before values have finished searching, clear the textbox
    userEvent.clear(textbox);

    act(() => {
      jest.runAllTimers();
    });

    // Should show keys, not values in dropdown
    expect(await screen.findByText('Keys')).toBeInTheDocument();
    expect(screen.queryByText('Values')).not.toBeInTheDocument();
  });

  it('autocompletes tag values', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();

    const getTagValuesMock = jest.fn().mockResolvedValue(['Chrome', 'Firefox']);

    render(
      <SmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        query=""
        onChange={mockOnChange}
      />
    );

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'browser:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const option = await screen.findByRole('option', {name: /Firefox/});

    userEvent.click(option);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'browser:Firefox ',
        expect.anything()
      );
    });
  });

  it('autocompletes tag values when there are other tags', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();

    const getTagValuesMock = jest.fn().mockResolvedValue(['Chrome', 'Firefox']);

    render(
      <SmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        excludedTags={['environment']}
        query="is:unresolved error.handled:true"
        onChange={mockOnChange}
      />
    );

    // Type "browser:" in between existing key/values
    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, {
      target: {value: 'is:unresolved browser: error.handled:true'},
    });

    // Make sure cursor is at end of "browser:""
    textbox.setSelectionRange(
      'is:unresolved browser:'.length,
      'is:unresolved browser:'.length
    );
    userEvent.click(textbox);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const option = await screen.findByRole('option', {name: /Firefox/});

    userEvent.click(option);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'is:unresolved browser:Firefox error.handled:true',
        expect.anything()
      );
    });
  });

  it('autocompletes tag values (user tag)', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();
    const getTagValuesMock = jest.fn().mockResolvedValue(['id:1']);

    render(
      <SmartSearchBar
        {...defaultProps}
        onGetTagValues={getTagValuesMock}
        query=""
        onChange={mockOnChange}
      />
    );

    const textbox = screen.getByRole('textbox');
    userEvent.type(textbox, 'user:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const option = await screen.findByRole('option', {name: /id:1/});

    userEvent.click(option);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith('user:"id:1" ', expect.anything());
    });
  });

  it('autocompletes tag values (predefined values with spaces)', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();

    render(
      <SmartSearchBar
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
    userEvent.type(textbox, 'predefined:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const option = await screen.findByRole('option', {
      name: /predefined tag with spaces/,
    });

    userEvent.click(option);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'predefined:"predefined tag with spaces" ',
        expect.anything()
      );
    });
  });

  it('autocompletes tag values (predefined values with quotes)', async function () {
    jest.useFakeTimers();
    const mockOnChange = jest.fn();

    render(
      <SmartSearchBar
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
    userEvent.type(textbox, 'predefined:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const option = await screen.findByRole('option', {
      name: /quotes/,
    });

    userEvent.click(option);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith(
        'predefined:"\\"predefined\\" \\"tag\\" \\"with\\" \\"quotes\\"" ',
        expect.anything()
      );
    });
  });

  describe('quick actions', function () {
    it('can delete tokens', function () {
      render(
        <SmartSearchBar
          {...defaultProps}
          query="is:unresolved sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');
      userEvent.click(textbox);

      // Put cursor inside is:resolved
      textbox.setSelectionRange(1, 1);

      userEvent.click(screen.getByRole('button', {name: /Delete/}));

      expect(textbox).toHaveValue('sdk.name:sentry-cocoa has:key');
    });

    it('can delete a middle token', function () {
      render(
        <SmartSearchBar
          {...defaultProps}
          query="is:unresolved sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');
      // Put cursor inside sdk.name
      textbox.setSelectionRange('is:unresolved s'.length, 'is:unresolved s'.length);
      userEvent.click(textbox);

      userEvent.click(screen.getByRole('button', {name: /Delete/}));

      expect(textbox).toHaveValue('is:unresolved has:key');
    });

    it('can exclude a token', function () {
      render(
        <SmartSearchBar
          {...defaultProps}
          query="is:unresolved sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');
      // Put cursor inside sdk.name
      textbox.setSelectionRange('is:unresolved sd'.length, 'is:unresolved sd'.length);
      userEvent.click(textbox);

      userEvent.click(screen.getByRole('button', {name: /Exclude/}));

      expect(textbox).toHaveValue('is:unresolved !sdk.name:sentry-cocoa has:key ');
    });

    it('can include a token', async function () {
      render(
        <SmartSearchBar
          {...defaultProps}
          query="is:unresolved !sdk.name:sentry-cocoa has:key"
        />
      );

      const textbox = screen.getByRole('textbox');
      // Put cursor inside sdk.name
      textbox.setSelectionRange('is:unresolved !s'.length, 'is:unresolved !s'.length);
      userEvent.click(textbox);

      expect(textbox).toHaveValue('is:unresolved !sdk.name:sentry-cocoa has:key ');

      await screen.findByRole('button', {name: /Include/});
      userEvent.click(screen.getByRole('button', {name: /Include/}));

      expect(textbox).toHaveValue('is:unresolved sdk.name:sentry-cocoa has:key ');
    });
  });

  it('displays invalid field message', async function () {
    render(<SmartSearchBar {...defaultProps} query="" />);

    const textbox = screen.getByRole('textbox');

    userEvent.type(textbox, 'invalid:');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(
      await screen.findByRole('option', {name: /the field invalid isn't supported here/i})
    ).toBeInTheDocument();
  });

  describe('date fields', () => {
    // Transpile the lazy-loaded datepicker up front so tests don't flake
    beforeAll(async function () {
      await import('sentry/components/calendar/datePicker');
    });

    it('displays date picker dropdown when appropriate', () => {
      render(<SmartSearchBar {...defaultProps} query="" />);

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
      render(<SmartSearchBar {...defaultProps} query="" />);

      userEvent.type(screen.getByRole('textbox'), 'lastSeen:');

      userEvent.click(screen.getByText('Last hour'));

      expect(screen.getByRole('textbox')).toHaveValue('lastSeen:-1h ');
    });

    it('can select a specific date/time', async () => {
      render(<SmartSearchBar {...defaultProps} query="" />);

      userEvent.type(screen.getByRole('textbox'), 'lastSeen:');

      userEvent.click(screen.getByText('After a custom datetime'));

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
      render(<SmartSearchBar {...defaultProps} query="" />);

      const textbox = screen.getByRole('textbox');
      fireEvent.change(textbox, {
        target: {value: 'lastSeen:2022-01-02 firstSeen:2022-01-01'},
      });

      // Move cursor to the lastSeen date
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

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
      render(<SmartSearchBar {...defaultProps} query="lastSeen:2022-01-01" />);

      const textbox = screen.getByRole('textbox');
      // Move cursor to the timestamp
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

      userEvent.click(screen.getByRole('textbox'));

      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      // No time provided, so time input should be the default value
      expect(screen.getByLabelText('Time')).toHaveValue('00:00:00');
      // UTC is checked because there is no timezone
      expect(screen.getByLabelText('Use UTC')).toBeChecked();
    });

    it('populates the date picker correctly for date with time and no timezone', async () => {
      render(<SmartSearchBar {...defaultProps} query="lastSeen:2022-01-01T09:45:12" />);

      const textbox = screen.getByRole('textbox');
      // Move cursor to the timestamp
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      expect(screen.getByLabelText('Time')).toHaveValue('09:45:12');
      expect(screen.getByLabelText('Use UTC')).toBeChecked();
    });

    it('populates the date picker correctly for date with time and timezone', async () => {
      render(
        <SmartSearchBar {...defaultProps} query="lastSeen:2022-01-01T09:45:12-05:00" />
      );

      const textbox = screen.getByRole('textbox');
      // Move cursor to the timestamp
      userEvent.click(textbox);
      textbox.setSelectionRange(10, 10);
      fireEvent.focus(textbox);

      const dateInput = await screen.findByTestId('date-picker');

      expect(dateInput).toHaveValue('2022-01-01');
      expect(screen.getByLabelText('Time')).toHaveValue('09:45:12');
      expect(screen.getByLabelText('Use UTC')).not.toBeChecked();
    });
  });

  describe('custom performance metric filters', () => {
    it('raises Invalid file size when parsed filter unit is not a valid size unit', () => {
      render(
        <SmartSearchBar
          {...defaultProps}
          customPerformanceMetrics={{
            'measurements.custom.kibibyte': {
              fieldType: 'size',
            },
          }}
        />
      );

      const textbox = screen.getByRole('textbox');
      userEvent.click(textbox);
      userEvent.type(textbox, 'measurements.custom.kibibyte:10ms ');
      userEvent.keyboard('{arrowleft}');

      expect(
        screen.getByText(
          'Invalid file size. Expected number followed by file size unit suffix'
        )
      ).toBeInTheDocument();
    });

    it('raises Invalid duration when parsed filter unit is not a valid duration unit', () => {
      render(
        <SmartSearchBar
          {...defaultProps}
          customPerformanceMetrics={{
            'measurements.custom.minute': {
              fieldType: 'duration',
            },
          }}
        />
      );

      const textbox = screen.getByRole('textbox');
      userEvent.click(textbox);
      userEvent.type(textbox, 'measurements.custom.minute:10kb ');
      userEvent.keyboard('{arrowleft}');

      expect(
        screen.getByText(
          'Invalid duration. Expected number followed by duration unit suffix'
        )
      ).toBeInTheDocument();
    });
  });
});
