import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Version from 'sentry/components/version';

const VERSION = 'foo.bar.Baz@1.0.0+20200101';

describe('Version', () => {
  const context = RouterContextFixture();
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
    render(<Version version={VERSION} projectId="1" />, {
      context,
    });

    await userEvent.click(screen.getByText('1.0.0 (20200101)'));
    expect(context.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/releases/foo.bar.Baz%401.0.0%2B20200101/',
      query: {project: '1'},
    });
  });

  it('shows raw version in tooltip', async () => {
    jest.useFakeTimers();
    render(<Version version={VERSION} tooltipRawVersion />, {
      context,
    });
    expect(screen.queryByText(VERSION)).not.toBeInTheDocument();

    // Activate tooltip
    await userEvent.hover(screen.getByText('1.0.0 (20200101)'), {delay: null});
    act(() => jest.advanceTimersByTime(50));

    expect(screen.getByText(VERSION)).toBeInTheDocument();
  });
});
