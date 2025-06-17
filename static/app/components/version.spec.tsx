import {RouterFixture} from 'sentry-fixture/routerFixture';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Version from 'sentry/components/version';

const VERSION = 'foo.bar.Baz@1.0.0+20200101';

describe('Version', () => {
  const router = RouterFixture();
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', () => {
    render(<Version version={VERSION} />, {
      deprecatedRouterMocks: true,
    });
  });

  it('shows correct parsed version', () => {
    // component uses @sentry/release-parser package for parsing versions
    render(<Version version={VERSION} />, {
      deprecatedRouterMocks: true,
    });

    expect(screen.getByText('1.0.0 (20200101)')).toBeInTheDocument();
  });

  it('links to release page', async () => {
    render(<Version version={VERSION} projectId="1" />, {
      router,
      deprecatedRouterMocks: true,
    });

    await userEvent.click(screen.getByText('1.0.0 (20200101)'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mock-pathname/',
      query: {
        rd: 'show',
        rdRelease: 'foo.bar.Baz@1.0.0+20200101',
        rdReleaseProjectId: '1',
        rdSource: 'release-version-link',
      },
    });
  });

  it('shows raw version in tooltip', async () => {
    jest.useFakeTimers();
    render(<Version version={VERSION} tooltipRawVersion />, {
      router,
      deprecatedRouterMocks: true,
    });
    expect(screen.queryByText(VERSION)).not.toBeInTheDocument();

    // Activate tooltip
    await userEvent.hover(screen.getByText('1.0.0 (20200101)'), {delay: null});
    act(() => jest.advanceTimersByTime(50));

    expect(await screen.findByText(VERSION)).toBeInTheDocument();
  });
});
