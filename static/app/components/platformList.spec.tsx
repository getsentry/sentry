import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PlatformList from 'sentry/components/platformList';
import {PlatformKey} from 'sentry/data/platformCategories';

describe('PlatformList', function () {
  const platforms: PlatformKey[] = ['java', 'php', 'javascript', 'cocoa-swift', 'ruby'];

  it('renders max of three icons from platforms', function () {
    render(<PlatformList platforms={platforms} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('renders default if no platforms', function () {
    render(<PlatformList platforms={[]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('displays counter', async function () {
    render(<PlatformList platforms={platforms} showCounter />);
    const icons = screen.getAllByRole('img');
    expect(icons).toHaveLength(3);

    // Check tooltip content,
    const extra = screen.getByText('2');
    await userEvent.hover(extra);
    expect(await screen.findByText('2 other platforms')).toBeInTheDocument();
  });

  it('displays counter according to the max value', function () {
    const max = 2;
    render(<PlatformList platforms={platforms} max={max} showCounter />);
    const icons = screen.getAllByRole('img');
    expect(icons).toHaveLength(max);

    const extraCounter = platforms.length - max;
    expect(screen.getByText(extraCounter)).toBeInTheDocument();
  });
});
