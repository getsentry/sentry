import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProbablyFineView from './index';

describe('ProbablyFineView', () => {
  it('renders the page title and subtitle', () => {
    render(<ProbablyFineView />);

    expect(screen.getByText('Probably Fine')).toBeInTheDocument();
    expect(
      screen.getByText('AI-powered error triage to help you focus on what really matters')
    ).toBeInTheDocument();
  });

  it('shows loading state while analyzing', async () => {
    render(<ProbablyFineView />);

    // Should show loading indicator initially
    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('displays issues after analysis completes', async () => {
    render(<ProbablyFineView />);

    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Should show progress bar
    expect(screen.getByText(/issues triaged/i)).toBeInTheDocument();

    // Should show issue list with tier sections
    expect(screen.getByText('Fix Now')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Probably Fine')).toBeInTheDocument();
  });

  it('shows correct issue counts in tier sections', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Check for issue counts (based on mock data: 3 fix_now, 5 review, 12 probably_fine)
    expect(screen.getByText('3 issues')).toBeInTheDocument();
    expect(screen.getByText('5 issues')).toBeInTheDocument();
    expect(screen.getByText('12 issues')).toBeInTheDocument();
  });

  it('allows dismissing individual issues', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Get all dismiss buttons
    const dismissButtons = screen.getAllByRole('button', {name: /dismiss/i});
    const initialButtonCount = dismissButtons.length;

    // Click the first dismiss button
    await userEvent.click(dismissButtons[0]);

    // Wait for the issue to be dismissed
    await waitFor(() => {
      const updatedButtons = screen.getAllByRole('button', {name: /dismiss/i});
      expect(updatedButtons.length).toBe(initialButtonCount - 1);
    });
  });

  it('allows bulk dismissing all issues in a tier', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Find "Dismiss All" button for Probably Fine tier
    const dismissAllButtons = screen.getAllByRole('button', {name: 'Dismiss All'});

    // Click the last one (Probably Fine section)
    await userEvent.click(dismissAllButtons[dismissAllButtons.length - 1]);

    // Wait for the tier to disappear or show 0 issues
    await waitFor(() => {
      // After dismissing all "probably_fine" issues, that tier should be gone
      const probablyFineSections = screen.queryAllByText('Probably Fine');
      // Badge might still be visible, but issue count should change
      expect(screen.queryByText('12 issues')).not.toBeInTheDocument();
    });
  });

  it('shows celebration when all issues are dismissed', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Dismiss all tiers
    const dismissAllButtons = screen.getAllByRole('button', {name: 'Dismiss All'});

    for (const button of dismissAllButtons) {
      await userEvent.click(button);
    }

    // Should show inbox zero celebration
    await waitFor(() => {
      expect(screen.getByText('Inbox Zero!')).toBeInTheDocument();
    });
  });

  it('allows re-analyzing issues', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const reAnalyzeButton = screen.getByRole('button', {name: 'Re-analyze'});
    await userEvent.click(reAnalyzeButton);

    // Should show loading state again
    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('allows resetting the demo', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Dismiss some issues first
    const dismissButtons = screen.getAllByRole('button', {name: /dismiss/i});
    await userEvent.click(dismissButtons[0]);

    // Reset demo
    const resetButton = screen.getByRole('button', {name: 'Reset Demo'});
    await userEvent.click(resetButton);

    // Should show loading state
    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('displays progress bar with correct percentage', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Initially, 0 issues triaged out of 20
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('of')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('updates progress when issues are dismissed', async () => {
    render(<ProbablyFineView />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Dismiss one tier (12 probably_fine issues)
    const dismissAllButtons = screen.getAllByRole('button', {name: 'Dismiss All'});
    await userEvent.click(dismissAllButtons[dismissAllButtons.length - 1]);

    // Wait for progress to update
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // 12 triaged
      expect(screen.getByText('60%')).toBeInTheDocument(); // 12/20 = 60%
    });
  });
});
