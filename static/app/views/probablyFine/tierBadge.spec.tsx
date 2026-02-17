import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TierBadge} from './tierBadge';
import {ActionabilityTier} from './types';

describe('TierBadge', () => {
  it('renders FIX_NOW badge with correct text', () => {
    render(<TierBadge tier={ActionabilityTier.FIX_NOW} />);

    expect(screen.getByText('FIX NOW')).toBeInTheDocument();
  });

  it('renders REVIEW badge with correct text', () => {
    render(<TierBadge tier={ActionabilityTier.REVIEW} />);

    expect(screen.getByText('REVIEW')).toBeInTheDocument();
  });

  it('renders PROBABLY_FINE badge with correct text and checkmark', () => {
    render(<TierBadge tier={ActionabilityTier.PROBABLY_FINE} />);

    expect(screen.getByText('PROBABLY FINE')).toBeInTheDocument();
    // Check for checkmark icon
    expect(screen.getByLabelText(/icon-checkmark/i)).toBeInTheDocument();
  });

  it('displays confidence percentage when provided', () => {
    render(<TierBadge tier={ActionabilityTier.FIX_NOW} confidence={0.95} />);

    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('does not display confidence when not provided', () => {
    render(<TierBadge tier={ActionabilityTier.REVIEW} />);

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders small size badge', () => {
    const {container} = render(
      <TierBadge tier={ActionabilityTier.FIX_NOW} size="sm" />
    );

    // Small badge should have smaller font
    expect(container.firstChild).toHaveStyle({fontSize: '11px'});
  });

  it('renders medium size badge by default', () => {
    const {container} = render(<TierBadge tier={ActionabilityTier.REVIEW} />);

    expect(container.firstChild).toHaveStyle({fontSize: '12px'});
  });

  it('renders large size badge', () => {
    const {container} = render(
      <TierBadge tier={ActionabilityTier.PROBABLY_FINE} size="lg" />
    );

    expect(container.firstChild).toHaveStyle({fontSize: '14px'});
  });

  it('rounds confidence to nearest integer', () => {
    render(<TierBadge tier={ActionabilityTier.FIX_NOW} confidence={0.956} />);

    expect(screen.getByText('96%')).toBeInTheDocument();
  });

  it('handles 0% confidence', () => {
    render(<TierBadge tier={ActionabilityTier.REVIEW} confidence={0.0} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('handles 100% confidence', () => {
    render(<TierBadge tier={ActionabilityTier.FIX_NOW} confidence={1.0} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
