import {AutofixRootCauseData} from 'sentry-fixture/autofixRootCauseData';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';

describe('AutofixRootCause', function () {
  let mockApi: jest.Mock<any, any, any>;

  beforeEach(function () {
    mockApi = MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  const defaultProps = {
    causes: [AutofixRootCauseData()],
    groupId: '1',
    rootCauseSelection: null,
    runId: '101',
    repos: [],
  };

  it('can view a relevant code snippet', async function () {
    render(<AutofixRootCause {...defaultProps} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(
      screen.getByText(defaultProps.causes[0]!.root_cause_reproduction![0]!.title)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('autofix-root-cause-timeline-item-0'));
    expect(
      screen.getByText(
        defaultProps.causes[0]!.root_cause_reproduction![0]!.code_snippet_and_analysis
      )
    ).toBeInTheDocument();
  });

  it('shows graceful error state when there are no causes', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [],
          terminationReason: 'The error comes from outside the codebase.',
        }}
      />
    );

    expect(
      screen.getByText('No root cause found. The error comes from outside the codebase.')
    ).toBeInTheDocument();
  });

  it('can edit and submit custom root cause', async function () {
    render(<AutofixRootCause {...defaultProps} />);

    // Click edit button
    await userEvent.click(screen.getByTestId('autofix-root-cause-edit-button'));

    // Verify textarea appears
    const textarea = screen.getByPlaceholderText('Propose your own root cause...');
    expect(textarea).toBeInTheDocument();

    // Enter custom root cause
    await userEvent.type(textarea, 'This is a custom root cause');

    // Click Save button
    await userEvent.click(screen.getByTestId('autofix-root-cause-save-edit-button'));

    // Verify API was called with correct payload
    expect(mockApi).toHaveBeenCalledWith(
      '/issues/1/autofix/update/',
      expect.objectContaining({
        method: 'POST',
        data: {
          run_id: '101',
          payload: {
            type: 'select_root_cause',
            custom_root_cause: 'This is a custom root cause',
          },
        },
      })
    );
  });

  it('shows selected root cause when rootCauseSelection is provided', function () {
    const selectedCause = AutofixRootCauseData();
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          rootCauseSelection: {
            cause_id: selectedCause.id,
          },
        }}
      />
    );

    // Verify selected root cause is displayed
    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(
      screen.getByText(selectedCause.root_cause_reproduction![0]!.title)
    ).toBeInTheDocument();
  });

  it('shows custom root cause when rootCauseSelection has custom_root_cause', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          rootCauseSelection: {
            custom_root_cause: 'This is a custom root cause',
          },
        }}
      />
    );

    expect(screen.getByText('Custom Root Cause')).toBeInTheDocument();
    expect(screen.getByText('This is a custom root cause')).toBeInTheDocument();
  });
});
