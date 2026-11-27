import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SingleRunStopNotice} from './singleRunStopNotice';

describe('SingleRunStopNotice', () => {
  it('shows the first sentence of the reason and the full reason on click', async () => {
    render(
      <SingleRunStopNotice
        stop={{
          reason:
            'The error comes from a flaky upstream. It recovers on retry, so no code change helps.',
          suggestion: 'Ignore the issue until it escalates.',
        }}
      />
    );

    const notice = screen.getByTestId('autofix-single-run-stop');
    expect(notice).toHaveTextContent(
      'Seer stopped early: The error comes from a flaky upstream.'
    );
    expect(notice).toHaveTextContent('Next step: Ignore the issue until it escalates.');
    expect(screen.queryByText(/so no code change helps/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));

    expect(screen.getByText(/so no code change helps/)).toBeInTheDocument();
  });

  it('has nothing to expand when the reason is one sentence', () => {
    render(
      <SingleRunStopNotice
        stop={{
          reason: 'The issue is transient.',
          suggestion: 'Ignore the issue until it escalates.',
        }}
      />
    );

    expect(screen.getByTestId('autofix-single-run-stop')).toHaveTextContent(
      'Seer stopped early: The issue is transient.'
    );
    expect(screen.queryByRole('button', {name: 'Expand'})).not.toBeInTheDocument();
  });
});
