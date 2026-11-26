import {act, cleanup, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ImpactBadge} from './impactBadge';
import type {AssessedImpact} from './utils';

describe('ImpactBadge', () => {
  const impact: AssessedImpact = {
    level: 'low',
    score: 20,
    description: 'Few users are affected.',
    citations: [],
    sourceEventId: 'event-id',
  };

  afterEach(() => {
    try {
      cleanup();
      act(() => {
        jest.runOnlyPendingTimers();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the assessment in the hovercard', async () => {
    jest.useFakeTimers();
    render(<ImpactBadge impact={impact} hovercard />);

    await userEvent.hover(screen.getByText('Low (20)'), {delay: null});
    act(() => jest.advanceTimersByTime(300));

    expect(screen.getByText('Few users are affected.')).toBeInTheDocument();
    expect(screen.getByText(/This issue has a/)).toHaveTextContent(
      'This issue has a Low impact on users'
    );
  });

  it('does not open a hovercard when disabled', async () => {
    jest.useFakeTimers();
    render(<ImpactBadge impact={impact} />);

    await userEvent.hover(screen.getByText('Low (20)'), {delay: null});
    act(() => jest.advanceTimersByTime(300));

    expect(screen.queryByText('Few users are affected.')).not.toBeInTheDocument();
  });
});
