import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PlatformList} from 'sentry/components/platformList';
import type {PlatformKey} from 'sentry/types/platform';

describe('PlatformList', () => {
  const platforms: PlatformKey[] = ['java', 'php', 'javascript', 'cocoa-swift', 'ruby'];

  it('renders max of three icons from platforms', () => {
    render(<PlatformList platforms={platforms} />);
    // Icons are decorative (alt="") so they are queried by test id rather than
    // the img role.
    expect(screen.getAllByTestId(/^platform-icon-/)).toHaveLength(3);
  });

  it('renders default if no platforms', () => {
    render(<PlatformList platforms={[]} />);
    expect(screen.getByTestId('platform-icon-default')).toBeInTheDocument();
  });

  it('displays max number of icons', () => {
    const max = 2;
    render(<PlatformList platforms={platforms} max={max} />);
    const icons = screen.getAllByTestId(/^platform-icon-/);
    expect(icons).toHaveLength(max);
  });
});
