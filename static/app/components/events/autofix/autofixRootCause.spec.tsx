import {AutofixRootCauseData} from 'sentry-fixture/autofixRootCauseData';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';

describe('AutofixRootCause', function () {
  const defaultProps = {
    causes: [AutofixRootCauseData()],
    groupId: '1',
    rootCauseSelection: null,
    runId: '101',
  };

  it('can select a suggested fix', async function () {
    const mockSelectFix = MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    render(<AutofixRootCause {...defaultProps} />);

    // Displays all root cause and suggested fix info
    expect(screen.getByText('This is the title of a root cause.')).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a root cause.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Suggested Fix #1: This is the title of a suggested fix.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This is the description of a suggested fix.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Continue With This Fix'}));

    expect(mockSelectFix).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          run_id: '101',
          payload: {
            type: 'select_root_cause',
            cause_id: '100',
            fix_id: '200',
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
    await userEvent.click(screen.getByRole('button', {name: 'Continue With This Fix'}));

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
});
