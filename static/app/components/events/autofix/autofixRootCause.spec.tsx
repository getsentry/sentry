import {AutofixRootCauseData} from 'sentry-fixture/autofixRootCauseData';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';

describe('AutofixRootCause', function () {
  let mockApi: jest.Mock<any, any, any>;

  beforeEach(function () {
    mockApi = MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
      body: {success: true},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllTimers();
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

    // Wait for initial render and animations
    await waitFor(
      () => {
        expect(screen.getByText('Root Cause')).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(defaultProps.causes[0]!.root_cause_reproduction![0]!.title)
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    await userEvent.click(screen.getByTestId('autofix-root-cause-timeline-item-0'));

    // Wait for code snippet to appear with increased timeout for animation
    await waitFor(
      () => {
        expect(
          screen.getByText(
            defaultProps.causes[0]!.root_cause_reproduction![0]!.code_snippet_and_analysis
          )
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  });

  it('shows graceful error state when there are no causes', async function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [],
          terminationReason: 'The error comes from outside the codebase.',
        }}
      />
    );

    // Wait for error state to render
    await waitFor(
      () => {
        expect(
          screen.getByText(
            'No root cause found. The error comes from outside the codebase.'
          )
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  });

  it('can edit and submit custom root cause', async function () {
    render(<AutofixRootCause {...defaultProps} />);

    // Wait for initial render
    await waitFor(
      () => {
        expect(screen.getByText('Root Cause')).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    // Click edit button
    await userEvent.click(screen.getByTestId('autofix-root-cause-edit-button'));

    // Verify textarea appears
    const textarea = screen.getByPlaceholderText('Propose your own root cause...');
    expect(textarea).toBeInTheDocument();

    // Enter custom root cause
    await userEvent.type(textarea, 'This is a custom root cause');

    // Click Save button
    await userEvent.click(screen.getByTestId('autofix-root-cause-save-edit-button'));

    // Wait for API call to complete
    await waitFor(
      () => {
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
      },
      {timeout: 2000}
    );
  });

  it('shows selected root cause when rootCauseSelection is provided', async function () {
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

    // Wait for selected root cause to render
    await waitFor(
      () => {
        expect(screen.getByText('Root Cause')).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(selectedCause.root_cause_reproduction![0]!.title)
        ).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  });

  it('shows custom root cause when rootCauseSelection has custom_root_cause', async function () {
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

    // Wait for custom root cause to render
    await waitFor(
      () => {
        expect(screen.getByText('Custom Root Cause')).toBeInTheDocument();
      },
      {timeout: 2000}
    );

    await waitFor(
      () => {
        expect(screen.getByText('This is a custom root cause')).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  });
});
