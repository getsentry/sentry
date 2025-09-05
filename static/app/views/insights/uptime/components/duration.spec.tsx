import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';
import {UptimeDuration} from 'sentry/views/insights/uptime/components/duration';

describe('UptimeDuration', () => {
  const baseSummary: UptimeSummary = {
    avgDurationUs: null,
    downtimeChecks: 0,
    failedChecks: 0,
    missedWindowChecks: 0,
    totalChecks: 100,
  };

  it('renders nothing when avgDurationUs is null', () => {
    const {container} = render(<UptimeDuration summary={baseSummary} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders millisecond durations correctly', () => {
    const summary = {...baseSummary, avgDurationUs: 350_000};
    render(<UptimeDuration summary={summary} />);
    expect(screen.getByText('350ms')).toBeInTheDocument();
  });

  it('renders second durations correctly', () => {
    const summary = {...baseSummary, avgDurationUs: 2_500_000};
    render(<UptimeDuration summary={summary} />);
    expect(screen.getByText('3s')).toBeInTheDocument();
  });
});
