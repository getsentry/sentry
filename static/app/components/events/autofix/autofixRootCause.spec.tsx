import {AutofixRootCauseData} from 'sentry-fixture/autofixRootCauseData';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';

describe('AutofixRootCause', function () {
  let mockApi;

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

  it('can view a relevant code snippet', function () {
    render(<AutofixRootCause {...defaultProps} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(screen.getByText('This is the title of a root cause.')).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a root cause.')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Snippet #1: This is the title of a relevant code snippet.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a relevant code snippet.')
    ).toBeInTheDocument();

    // Add test for new buttons
    expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Find Fix'})).toBeInTheDocument();
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

  it('shows hyperlink when matching GitHub repo available', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          repos: [
            {
              default_branch: 'main',
              external_id: 'id',
              name: 'owner/repo',
              provider: 'integrations:github',
              url: 'https://github.com/test_owner/test_repo',
            },
          ],
        }}
      />
    );

    expect(screen.getByRole('link', {name: 'GitHub'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'GitHub'})).toHaveAttribute(
      'href',
      'https://github.com/test_owner/test_repo/blob/main/src/file.py'
    );
  });

  it('shows no hyperlink when no matching GitHub repo available', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          repos: [],
        }}
      />
    );

    expect(screen.queryByRole('link', {name: 'GitHub'})).not.toBeInTheDocument();
  });

  it('shows reproduction steps when applicable', async function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [AutofixRootCauseData()],
        }}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: 'How to reproduce',
      })
    );

    expect(
      screen.getByText('This is the reproduction of a root cause.')
    ).toBeInTheDocument();
  });

  it('does not show reproduction steps when not applicable', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [AutofixRootCauseData({reproduction: undefined})],
        }}
      />
    );

    expect(
      screen.queryByText('This is the reproduction of a root cause.')
    ).not.toBeInTheDocument();
  });

  it('shows unit test inside reproduction card when available', async function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [
            AutofixRootCauseData({
              unit_test: {
                snippet: 'Test case for root cause',
                description: 'This is the description of a unit test.',
                file_path: 'src/file.py',
              },
            }),
          ],
        }}
      />
    );

    expect(screen.getByText('How to reproduce')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'How to reproduce',
      })
    );
    expect(
      screen.getByText('This is the description of a unit test.')
    ).toBeInTheDocument();
    expect(screen.getByText('Test case for root cause')).toBeInTheDocument();
  });

  it('does not show reproduction or unit test when not available', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [AutofixRootCauseData({unit_test: undefined, reproduction: undefined})],
        }}
      />
    );

    expect(screen.queryByText('How to reproduce')).not.toBeInTheDocument();
  });

  it('can edit and submit custom root cause', async function () {
    render(<AutofixRootCause {...defaultProps} />);

    // Click edit button
    await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

    // Verify textarea appears
    const textarea = screen.getByPlaceholderText('Propose your own root cause...');
    expect(textarea).toBeInTheDocument();

    // Enter custom root cause
    await userEvent.type(textarea, 'This is a custom root cause');

    // Click Find Fix button
    await userEvent.click(screen.getByRole('button', {name: 'Find Fix'}));

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

  it('can select suggested root cause', async function () {
    const cause = AutofixRootCauseData();
    render(<AutofixRootCause {...defaultProps} causes={[cause]} />);

    // Click Find Fix button
    await userEvent.click(screen.getByRole('button', {name: 'Find Fix'}));

    // Verify API was called with correct payload
    expect(mockApi).toHaveBeenCalledWith(
      '/issues/1/autofix/update/',
      expect.objectContaining({
        method: 'POST',
        data: {
          run_id: '101',
          payload: {
            type: 'select_root_cause',
            cause_id: cause.id,
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
    expect(screen.getByText('This is the title of a root cause.')).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a root cause.')
    ).toBeInTheDocument();

    // Verify edit/find fix buttons are not present
    expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Find Fix'})).not.toBeInTheDocument();
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
