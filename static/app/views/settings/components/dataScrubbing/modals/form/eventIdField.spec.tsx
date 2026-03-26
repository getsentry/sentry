import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {valueSuggestions} from 'sentry/views/settings/components/dataScrubbing/utils';

import {EventIdField} from './eventIdField';

const VALID_EVENT_ID = '887ab369df634e74aea708bcafe1a175';

const defaultFieldProps = {
  'aria-describedby': 'hint-id',
  'aria-invalid': false,
  disabled: false,
  id: 'event-id',
  name: 'eventId',
  onBlur: jest.fn(),
};

function renderEventIdField(
  props: Partial<React.ComponentProps<typeof EventIdField>> = {}
) {
  return render(
    <EventIdField
      fieldProps={defaultFieldProps}
      value=""
      onChange={jest.fn()}
      onSuggestionsLoaded={jest.fn()}
      onErrorChange={jest.fn()}
      orgSlug="test-org"
      {...props}
    />
  );
}

describe('EventIdField', () => {
  beforeEach(() => {
    defaultFieldProps.onBlur.mockClear();
  });

  it('renders input with placeholder', () => {
    renderEventIdField();

    expect(screen.getByPlaceholderText('XXXXXXXXXXXXXX')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('renders with a value', () => {
    renderEventIdField({value: VALID_EVENT_ID});

    expect(screen.getByRole('textbox')).toHaveValue(VALID_EVENT_ID);
  });

  it('strips hyphens from input on change', async () => {
    const handleChange = jest.fn();
    renderEventIdField({onChange: handleChange});

    await userEvent.type(screen.getByRole('textbox'), 'a-b');

    expect(handleChange).toHaveBeenCalledWith('a');
    expect(handleChange).not.toHaveBeenCalledWith('-');
    expect(handleChange).toHaveBeenCalledWith('b');
  });

  it('triggers fetch on blur with valid ID', async () => {
    const onSuggestionsLoaded = jest.fn();
    const onErrorChange = jest.fn();

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/test-org/data-scrubbing-selector-suggestions/',
      body: {suggestions: [{type: 'value', value: '$message'}]},
    });

    renderEventIdField({
      value: VALID_EVENT_ID,
      onSuggestionsLoaded,
      onErrorChange,
    });

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    await waitFor(() => expect(mockRequest).toHaveBeenCalled());

    await waitFor(() =>
      expect(onSuggestionsLoaded).toHaveBeenCalledWith([
        {type: 'value', value: '$message'},
      ])
    );
  });

  it('triggers fetch on Enter with valid ID', async () => {
    const onSuggestionsLoaded = jest.fn();

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/test-org/data-scrubbing-selector-suggestions/',
      body: {suggestions: [{type: 'value', value: '$message'}]},
    });

    renderEventIdField({
      value: VALID_EVENT_ID,
      onSuggestionsLoaded,
    });

    await userEvent.type(screen.getByRole('textbox'), '{enter}');

    await waitFor(() => expect(mockRequest).toHaveBeenCalled());
  });

  it('shows checkmark on successful fetch with suggestions', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/data-scrubbing-selector-suggestions/',
      body: {suggestions: [{type: 'value', value: '$message'}]},
    });

    renderEventIdField({value: VALID_EVENT_ID});

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('calls onErrorChange with error for invalid event ID on blur', async () => {
    const onErrorChange = jest.fn();
    renderEventIdField({
      value: 'tooshort',
      onErrorChange,
    });

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    await waitFor(() =>
      expect(onErrorChange).toHaveBeenCalledWith('This event ID is invalid')
    );
  });

  it('calls onErrorChange with error when event ID not found', async () => {
    const onErrorChange = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/data-scrubbing-selector-suggestions/',
      body: {suggestions: []},
    });

    renderEventIdField({
      value: VALID_EVENT_ID,
      onErrorChange,
    });

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    await waitFor(() =>
      expect(onErrorChange).toHaveBeenCalledWith(
        'The chosen event ID was not found in projects you have access to'
      )
    );
  });

  it('calls onErrorChange with error on fetch failure', async () => {
    const onErrorChange = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/data-scrubbing-selector-suggestions/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    renderEventIdField({
      value: VALID_EVENT_ID,
      onErrorChange,
    });

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    await waitFor(() =>
      expect(onErrorChange).toHaveBeenCalledWith(
        'An error occurred while fetching the suggestions based on this event ID'
      )
    );
  });

  it('resets suggestions to defaults when event ID is not found', async () => {
    const onSuggestionsLoaded = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/data-scrubbing-selector-suggestions/',
      body: {suggestions: []},
    });

    renderEventIdField({
      value: VALID_EVENT_ID,
      onSuggestionsLoaded,
    });

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    await waitFor(() =>
      expect(onSuggestionsLoaded).toHaveBeenCalledWith(valueSuggestions)
    );
  });

  it('resets suggestions to defaults when fetch fails', async () => {
    const onSuggestionsLoaded = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/data-scrubbing-selector-suggestions/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    renderEventIdField({
      value: VALID_EVENT_ID,
      onSuggestionsLoaded,
    });

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    await waitFor(() =>
      expect(onSuggestionsLoaded).toHaveBeenCalledWith(valueSuggestions)
    );
  });

  it('shows nothing for UNDEFINED status initially', () => {
    renderEventIdField();

    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-close')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });
});
// trivial change for CI testing
