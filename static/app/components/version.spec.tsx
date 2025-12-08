import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Version from 'sentry/components/version';

const VERSION = 'foo.bar.Baz@1.0.0+20200101';

describe('Version', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', () => {
    render(<Version version={VERSION} />);
  });

  it('shows correct parsed version', () => {
    // component uses @sentry/release-parser package for parsing versions
    render(<Version version={VERSION} />);

    expect(screen.getByText('1.0.0 (20200101)')).toBeInTheDocument();
  });

  it('links to release page', async () => {
    const {router} = render(<Version version={VERSION} projectId="1" />);

    await userEvent.click(screen.getByText('1.0.0 (20200101)'));
    expect(router.location.query).toEqual({
      rd: 'show',
      rdRelease: 'foo.bar.Baz@1.0.0+20200101',
      rdReleaseProjectId: '1',
      rdSource: 'release-version-link',
    });
  });

  it('shows raw version in tooltip', async () => {
    jest.useFakeTimers();
    render(<Version version={VERSION} tooltipRawVersion />);
    expect(screen.queryByText(VERSION)).not.toBeInTheDocument();

    // Activate tooltip
    await userEvent.hover(screen.getByText('1.0.0 (20200101)'), {delay: null});
    act(() => jest.advanceTimersByTime(50));

    expect(await screen.findByText(VERSION)).toBeInTheDocument();
  });
});
