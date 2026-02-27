import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventIdField from 'sentry/views/settings/components/dataScrubbing/modals/form/eventIdField';

const eventIdValue = '887ab369df634e74aea708bcafe1a175';

function renderEventIdField(
  props: Partial<React.ComponentProps<typeof EventIdField>> = {}
) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <EventIdField orgSlug="sentry" onSuggestionsLoaded={jest.fn()} {...props} />
    </QueryClientProvider>
  );
}

describe('EventIdField', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('default render', () => {
    renderEventIdField();

    expect(screen.getByText('Event ID (Optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('XXXXXXXXXXXXXX')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');

    expect(
      screen.getByText(
        'Providing an event ID will automatically provide you a list of suggested sources'
      )
    ).toBeInTheDocument();
  });

  it('displays error for INVALID event ID', async () => {
    renderEventIdField();

    await userEvent.type(screen.getByRole('textbox'), 'tooshort{enter}');

    expect(screen.getByText('This event ID is invalid')).toBeInTheDocument();
  });

  it('fetches suggestions on valid event ID', async () => {
    const handleSuggestionsLoaded = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/sentry/data-scrubbing-selector-suggestions/',
      body: {
        suggestions: [{type: 'value', value: '$frame.abs_path'}],
      },
    });

    renderEventIdField({
      orgSlug: 'sentry',
      projectId: 'foo',
      onSuggestionsLoaded: handleSuggestionsLoaded,
    });

    await userEvent.type(screen.getByRole('textbox'), `${eventIdValue}{enter}`);

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();

    expect(handleSuggestionsLoaded).toHaveBeenCalledWith([
      {type: 'value', value: '$frame.abs_path'},
    ]);
  });

  it('shows error status on API failure', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/sentry/data-scrubbing-selector-suggestions/',
      statusCode: 500,
      body: {},
    });

    renderEventIdField();

    await userEvent.type(screen.getByRole('textbox'), `${eventIdValue}{enter}`);

    expect(
      await screen.findByText(
        'An error occurred while fetching the suggestions based on this event ID'
      )
    ).toBeInTheDocument();
  });

  it('shows NOT_FOUND status when no suggestions returned', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/sentry/data-scrubbing-selector-suggestions/',
      body: {
        suggestions: [],
      },
    });

    renderEventIdField();

    await userEvent.type(screen.getByRole('textbox'), `${eventIdValue}{enter}`);

    expect(
      await screen.findByText(
        'The chosen event ID was not found in projects you have access to'
      )
    ).toBeInTheDocument();
  });

  it('clears event ID on close icon click', async () => {
    const handleSuggestionsLoaded = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/sentry/data-scrubbing-selector-suggestions/',
      statusCode: 500,
      body: {},
    });

    renderEventIdField({onSuggestionsLoaded: handleSuggestionsLoaded});

    await userEvent.type(screen.getByRole('textbox'), `${eventIdValue}{enter}`);

    // Wait for error status to show close icon
    const closeIcon = await screen.findByTestId('icon-close');
    await userEvent.hover(closeIcon);
    expect(await screen.findByText('Clear event ID')).toBeInTheDocument();

    await userEvent.click(closeIcon);

    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(handleSuggestionsLoaded).toHaveBeenCalled();
  });
});
