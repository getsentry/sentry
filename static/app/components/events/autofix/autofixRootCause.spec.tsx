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

  it('can view a relevant code snippet', async function () {
    render(<AutofixRootCause {...defaultProps} />);

    // Displays all root cause and code context info
    expect(
      screen.getByText('Potential Root Cause: This is the title of a root cause.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a root cause.')
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Relevant code',
      })
    );
    expect(
      screen.getByText('Snippet #1: This is the title of a relevant code snippet.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a relevant code snippet.')
    ).toBeInTheDocument();
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

  it('shows hyperlink when matching GitHub repo available', async function () {
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

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Relevant code',
      })
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
});
