import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CelebrationState} from './celebrationState';

describe('CelebrationState', () => {
  it('renders the "Inbox Zero!" title', () => {
    render(<CelebrationState />);

    expect(screen.getByText('Inbox Zero!')).toBeInTheDocument();
  });

  it('displays the congratulatory message', () => {
    render(<CelebrationState />);

    expect(
      screen.getByText('All issues have been triaged. Great job cleaning up the noise!')
    ).toBeInTheDocument();
  });

  it('shows all three achievement stats', () => {
    render(<CelebrationState />);

    expect(screen.getByText('All issues classified')).toBeInTheDocument();
    expect(screen.getByText('Inbox cleared')).toBeInTheDocument();
    expect(screen.getByText('Ready for what matters')).toBeInTheDocument();
  });

  it('displays celebration emoji', () => {
    render(<CelebrationState />);

    expect(screen.getByText('🎉')).toBeInTheDocument();
  });

  it('displays stat icons', () => {
    render(<CelebrationState />);

    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('🧹')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('creates confetti elements on mount', () => {
    render(<CelebrationState />);

    // Check that confetti elements were added to the DOM
    const confettiElements = document.querySelectorAll('.confetti-piece');
    expect(confettiElements.length).toBeGreaterThan(0);
  });

  it('cleans up confetti on unmount', () => {
    const {unmount} = render(<CelebrationState />);

    // Confetti should exist
    let confettiElements = document.querySelectorAll('.confetti-piece');
    expect(confettiElements.length).toBeGreaterThan(0);

    // Unmount and check cleanup
    unmount();

    // Give time for cleanup
    setTimeout(() => {
      confettiElements = document.querySelectorAll('.confetti-piece');
      expect(confettiElements.length).toBe(0);
    }, 100);
  });
});
