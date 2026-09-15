import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ReplayPlatformIcon} from 'sentry/components/replays/replayPlatformIcon';

describe('ReplayPlatformIcon', () => {
  it('names the platform and version in a tooltip', async () => {
    render(<ReplayPlatformIcon name="Chrome" version="103.0.0" />);

    await userEvent.hover(screen.getByRole('img'));
    expect(await screen.findByText('Chrome 103.0.0')).toBeInTheDocument();
  });

  it('omits a missing version rather than leaving a trailing space', async () => {
    render(<ReplayPlatformIcon name="Chrome" version={null} />);

    await userEvent.hover(screen.getByRole('img'));
    expect(await screen.findByText('Chrome')).toBeInTheDocument();
  });

  it('falls back to Unknown when only the version is known', async () => {
    render(<ReplayPlatformIcon name={null} version="103.0.0" />);

    await userEvent.hover(screen.getByRole('img'));
    expect(await screen.findByText('Unknown 103.0.0')).toBeInTheDocument();
  });

  it('shows N/A instead of a generic icon when nothing is known', async () => {
    render(<ReplayPlatformIcon name={null} version={null} />);

    // There is no platform to draw, so this is the "not applicable" marker
    // rather than the default logo `generatePlatformIconName` would fall to.
    await userEvent.hover(screen.getByRole('img'));
    expect(await screen.findByText('N/A')).toBeInTheDocument();
  });

  it('renders children alongside the icon, inside the tooltip target', () => {
    render(
      <ReplayPlatformIcon name="Chrome" version="103.0.0">
        <button>Actions</button>
      </ReplayPlatformIcon>
    );

    expect(screen.getByRole('button', {name: 'Actions'})).toBeInTheDocument();
  });
});
