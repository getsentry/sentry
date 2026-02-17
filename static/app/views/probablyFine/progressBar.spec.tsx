import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProgressBar} from './progressBar';

describe('ProgressBar', () => {
  it('displays correct counts when no issues are triaged', () => {
    render(<ProgressBar total={20} triaged={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('of')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('issues triaged')).toBeInTheDocument();
  });

  it('displays correct percentage when no issues are triaged', () => {
    render(<ProgressBar total={20} triaged={0} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('displays correct counts when some issues are triaged', () => {
    render(<ProgressBar total={20} triaged={12} />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('calculates percentage correctly', () => {
    render(<ProgressBar total={20} triaged={12} />);

    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows 100% when all issues are triaged', () => {
    render(<ProgressBar total={20} triaged={20} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles zero total gracefully', () => {
    render(<ProgressBar total={0} triaged={0} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('rounds percentage to nearest integer', () => {
    render(<ProgressBar total={3} triaged={1} />);

    // 1/3 = 33.33...%, should round to 33%
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('displays progress bar fill with correct width', () => {
    const {container} = render(<ProgressBar total={20} triaged={10} />);

    // Find the bar fill element
    const barFill = container.querySelector('[style*="width"]');
    expect(barFill).toHaveStyle({width: '50%'});
  });

  it('shows 0 width when no progress', () => {
    const {container} = render(<ProgressBar total={10} triaged={0} />);

    const barFill = container.querySelector('[style*="width"]');
    expect(barFill).toHaveStyle({width: '0%'});
  });

  it('shows 100% width when all triaged', () => {
    const {container} = render(<ProgressBar total={10} triaged={10} />);

    const barFill = container.querySelector('[style*="width"]');
    expect(barFill).toHaveStyle({width: '100%'});
  });
});
