import {UptimeSummaryFixture} from 'sentry-fixture/uptimeSummary';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {UptimePercent} from './percent';

describe('UptimePercent', () => {
  const mockSummary = UptimeSummaryFixture();

  it('calculates and displays uptime percentage correctly', () => {
    // Known checks = totalChecks - missedWindowChecks = 100 - 2 = 98
    // Uptime calculation = (knownChecks - downtimeChecks) / knownChecks = (98 - 5) / 98 = 93/98 = 0.9489...
    // Uptime = 94.897% which rounds down to 94.897%
    render(<UptimePercent summary={mockSummary} />);

    expect(screen.getByText('94.897%')).toBeInTheDocument();
  });

  it('displays 100% uptime when all checks are successful', () => {
    const perfectSummary = UptimeSummaryFixture({
      downtimeChecks: 0,
      failedChecks: 0,
      missedWindowChecks: 0,
    });

    render(<UptimePercent summary={perfectSummary} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('displays 0% uptime when no checks are known', () => {
    const noKnownChecksSummary = UptimeSummaryFixture({
      downtimeChecks: 0,
      failedChecks: 0,
      missedWindowChecks: 100,
    });

    render(<UptimePercent summary={noKnownChecksSummary} />);

    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('displays uptime when some checks are down', () => {
    const allFailedSummary = UptimeSummaryFixture({
      downtimeChecks: 50,
      failedChecks: 48,
      missedWindowChecks: 2,
    });
    // knownChecks = 100 - 2 = 98, uptime = (98 - 50) / 98 = 48/98 = 0.48979... = 48.979%

    render(<UptimePercent summary={allFailedSummary} />);

    expect(screen.getByText('48.979%')).toBeInTheDocument();
  });

  it('handles zero total checks', () => {
    const zeroChecksSummary = UptimeSummaryFixture({
      totalChecks: 0,
      downtimeChecks: 0,
      failedChecks: 0,
      missedWindowChecks: 0,
    });

    render(<UptimePercent summary={zeroChecksSummary} />);

    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('rounds down to 3 decimal places', () => {
    const preciseSummary = UptimeSummaryFixture({
      downtimeChecks: 1,
      failedChecks: 0,
      missedWindowChecks: 0,
      totalChecks: 7,
    });
    // Uptime = 6/7 = 0.857142... which should round down to 85.714%

    render(<UptimePercent summary={preciseSummary} />);

    expect(screen.getByText('85.714%')).toBeInTheDocument();
  });

  it('shows tooltip with detailed breakdown on hover', async () => {
    render(<UptimePercent summary={mockSummary} note="This is a test" />);

    const percentageText = screen.getByText('94.897%');
    await userEvent.hover(percentageText);

    expect(await screen.findByText('This is a test')).toBeInTheDocument();
    expect(screen.getByText('Up Checks')).toBeInTheDocument();
    expect(screen.getByText('Failed Checks')).toBeInTheDocument();
    expect(screen.getByText('Down Checks')).toBeInTheDocument();
  });
});
