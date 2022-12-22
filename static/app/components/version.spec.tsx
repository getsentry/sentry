import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Version from 'sentry/components/version';

const VERSION = 'foo.bar.Baz@1.0.0+20200101';

describe('Version', () => {
  const context = TestStubs.routerContext();
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', () => {
    const {container} = render(<Version version={VERSION} />);
    expect(container).toSnapshot();
  });

  it('shows correct parsed version', () => {
    // component uses @sentry/release-parser package for parsing versions
    render(<Version version={VERSION} />);

    expect(screen.getByText('1.0.0 (20200101)')).toBeInTheDocument();
  });

  it('links to release page', () => {
    render(<Version version={VERSION} projectId="1" />, {
      context,
    });

    userEvent.click(screen.getByText('1.0.0 (20200101)'));
    expect(context.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/releases/foo.bar.Baz%401.0.0%2B20200101/',
      query: {project: '1'},
    });
  });

  it('shows raw version in tooltip', () => {
    jest.useFakeTimers();
    render(<Version version={VERSION} tooltipRawVersion />, {
      context,
    });
    expect(screen.queryByText(VERSION)).not.toBeInTheDocument();

    // Activate tooltip
    userEvent.hover(screen.getByText('1.0.0 (20200101)'));
    act(() => jest.advanceTimersByTime(50));

    expect(screen.getByText(VERSION)).toBeInTheDocument();
  });
});
