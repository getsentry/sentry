import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PlatformList} from 'sentry/components/platformList';
import type {PlatformKey} from 'sentry/types/project';

describe('PlatformList', () => {
  const platforms: PlatformKey[] = ['java', 'php', 'javascript', 'cocoa-swift', 'ruby'];

  it('renders max of three icons from platforms', () => {
    render(<PlatformList platforms={platforms} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('renders default if no platforms', () => {
    render(<PlatformList platforms={[]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('displays max number of icons', () => {
    const max = 2;
    render(<PlatformList platforms={platforms} max={max} />);
    const icons = screen.getAllByRole('img');
    expect(icons).toHaveLength(max);
  });
});
