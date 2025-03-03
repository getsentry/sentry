import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import AutofixInsightCards from 'sentry/components/events/autofix/autofixInsightCards';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';

jest.mock('sentry/actionCreators/indicator');

const sampleInsights: AutofixInsight[] = [
  {
    insight: 'Sample insight 1',
    justification: 'Sample justification 1',
  },
  {
    insight: 'User message',
    justification: 'USER',
  },
];

beforeEach(() => {
  (addSuccessMessage as jest.Mock).mockClear();
  (addErrorMessage as jest.Mock).mockClear();
  MockApiClient.clearMockResponses();
});

describe('AutofixInsightCards', () => {
  const renderComponent = (props = {}) => {
    return render(
      <AutofixInsightCards
        insights={sampleInsights}
        hasStepAbove={false}
        hasStepBelow={false}
        groupId="1"
        runId="1"
        stepIndex={0}
        {...props}
      />
    );
  };

  it('renders insights correctly', () => {
    renderComponent();
    expect(screen.getByText('Sample insight 1')).toBeInTheDocument();
    expect(screen.getByText('User message')).toBeInTheDocument();
  });

  it('renders user messages differently', () => {
    renderComponent();
    const userMessage = screen.getByText('User message');
    expect(userMessage.closest('div')).toHaveStyle('color: inherit');
  });

  it('toggles context expansion correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Sample insight 1');

    await userEvent.click(contextButton);
    await waitFor(() => {
      expect(screen.getByText('Sample justification 1')).toBeInTheDocument();
    });

    await userEvent.click(contextButton);
    await waitFor(() => {
      expect(screen.queryByText('Sample justification 1')).not.toBeInTheDocument();
    });
  });

  it('renders multiple insights correctly', () => {
    const multipleInsights = [
      ...sampleInsights,
      {
        insight: 'Another insight',
        justification: 'Another justification',
      },
    ];
    renderComponent({insights: multipleInsights});
    expect(screen.getByText('Sample insight 1')).toBeInTheDocument();
    expect(screen.getByText('User message')).toBeInTheDocument();
    expect(screen.getByText('Another insight')).toBeInTheDocument();
  });

  it('renders "Edit insight" buttons', () => {
    renderComponent();
    const editButtons = screen.getAllByRole('button', {name: 'Edit insight'});
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('shows edit input overlay when "Edit insight" is clicked', async () => {
    renderComponent();
    const editButton = screen.getAllByRole('button', {name: 'Edit insight'})[0]!;
    await userEvent.click(editButton);
    expect(
      screen.getByPlaceholderText('Share your own insight here...')
    ).toBeInTheDocument();
  });

  it('hides edit input when clicked cancel', async () => {
    renderComponent();
    const editButton = screen.getAllByRole('button', {name: 'Edit insight'})[0]!;
    await userEvent.click(editButton);
    expect(
      screen.getByPlaceholderText('Share your own insight here...')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Cancel'));
    expect(
      screen.queryByPlaceholderText('Share your own insight here...')
    ).not.toBeInTheDocument();
  });

  it('submits edit request when form is submitted', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    renderComponent();
    const editButton = screen.getAllByRole('button', {name: 'Edit insight'})[1]!;
    await userEvent.click(editButton);

    const input = screen.getByPlaceholderText('Share your own insight here...');
    await userEvent.type(input, 'Here is my insight.');

    const submitButton = screen.getByLabelText('Rethink from here using your insight');
    await userEvent.click(submitButton);

    expect(mockApi).toHaveBeenCalledWith(
      '/issues/1/autofix/update/',
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          run_id: '1',
          payload: expect.objectContaining({
            type: 'restart_from_point_with_feedback',
            message: 'Here is my insight.',
            step_index: 0,
            retain_insight_card_index: 1,
          }),
        }),
      })
    );
  });

  it('shows success message after successful edit submission', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    renderComponent();
    const editButton = screen.getAllByRole('button', {name: 'Edit insight'})[0]!;
    await userEvent.click(editButton);

    const input = screen.getByPlaceholderText('Share your own insight here...');
    await userEvent.type(input, 'Here is my insight.');

    const submitButton = screen.getByLabelText('Rethink from here using your insight');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith('Thanks, rethinking this...');
    });
  });

  it('shows error message after failed edit submission', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
      statusCode: 500,
    });

    renderComponent();
    const editButton = screen.getAllByRole('button', {name: 'Edit insight'})[0]!;
    await userEvent.click(editButton);

    const input = screen.getByPlaceholderText('Share your own insight here...');
    await userEvent.type(input, 'Here is my insight.');

    const submitButton = screen.getByLabelText('Rethink from here using your insight');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        'Something went wrong when sending Autofix your message.'
      );
    });
  });
});
