import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  ReplayPlatformIcon,
  ReplayPlatformIcons,
} from 'sentry/components/replays/replayPlatformIcon';

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

  it('renders children alongside the N/A marker too', () => {
    // The replays table hangs its filter menu off `children`, and an unknown
    // OS is still something to filter on, so the N/A branch has to keep it.
    render(
      <ReplayPlatformIcon name={null} version={null}>
        <button>Actions</button>
      </ReplayPlatformIcon>
    );

    expect(screen.getByRole('button', {name: 'Actions'})).toBeInTheDocument();
  });
});

describe('ReplayPlatformIcons', () => {
  const chrome = {name: 'Chrome', version: '103.0.0'};
  const macOS = {name: 'Mac OS X', version: '10.15.7'};
  const noBrowser = {name: null, version: null};

  it('shows the OS then the browser, each with its own tooltip', async () => {
    render(<ReplayPlatformIcons browser={chrome} os={macOS} />);

    const [os, browser] = screen.getAllByRole('img');

    await userEvent.hover(os!);
    expect(await screen.findByText('Mac OS X 10.15.7')).toBeInTheDocument();

    await userEvent.hover(browser!);
    expect(await screen.findByText('Chrome 103.0.0')).toBeInTheDocument();
  });

  it('shows the OS alone for a replay with no browser', async () => {
    render(<ReplayPlatformIcons browser={noBrowser} os={macOS} />);

    // A mobile replay has no browser, so it gets no second icon — and no
    // "N/A" marker standing in for one.
    const icon = screen.getByRole('img');
    await userEvent.hover(icon);

    expect(await screen.findByText('Mac OS X 10.15.7')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });
});
