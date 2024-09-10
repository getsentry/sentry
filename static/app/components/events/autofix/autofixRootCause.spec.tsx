import {AutofixRootCauseData} from 'sentry-fixture/autofixRootCauseData';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';

describe('AutofixRootCause', function () {
  const defaultProps = {
    causes: [AutofixRootCauseData()],
    groupId: '1',
    rootCauseSelection: null,
    runId: '101',
    repos: [],
  };

  it('can select a relevant code snippet', async function () {
    const mockSelectFix = MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    render(<AutofixRootCause {...defaultProps} />);

    // Displays all root cause and code context info
    expect(screen.getByText('This is the title of a root cause.')).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a root cause.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Relevant Code #1: This is the title of a relevant code snippet.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a relevant code snippet.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Find a Fix'}));

    expect(mockSelectFix).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          run_id: '101',
          payload: {
            type: 'select_root_cause',
            cause_id: '100',
          },
        },
      })
    );
  });

  it('can provide a custom root cause', async function () {
    const mockSelectFix = MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    render(<AutofixRootCause {...defaultProps} />);

    await userEvent.click(
      screen.getByRole('button', {name: 'Provide your own root cause'})
    );
    await userEvent.keyboard('custom root cause');
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Find a Fix',
        description: 'Find a Fix',
      })
    );

    expect(mockSelectFix).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          run_id: '101',
          payload: {
            type: 'select_root_cause',
            custom_root_cause: 'custom root cause',
          },
        },
      })
    );
  });

  it('shows graceful error state when there are no causes', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [],
        }}
      />
    );

    // Displays all root cause and code context info
    expect(
      screen.getByText('Autofix was not able to find a root cause. Maybe try again?')
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

    expect(screen.queryByRole('link', {name: 'GitHub'})).toBeInTheDocument();
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

  it('shows reproduction steps when applicable', function () {
    render(
      <AutofixRootCause
        {...{
          ...defaultProps,
          causes: [AutofixRootCauseData()],
        }}
      />
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
});
