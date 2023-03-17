import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';

import splitCrumbs from './splitCrumbs';

const PAGELOAD_CRUMB = TestStubs.Breadcrumb({
  id: 4,
  data: {
    to: 'https://sourcemaps.io/',
  },
}) as BreadcrumbTypeNavigation;

const NAV_CRUMB_BOOTSTRAP = TestStubs.Breadcrumb({
  id: 5,
  data: {
    from: '/',
    to: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
  },
}) as BreadcrumbTypeNavigation;

const NAV_CRUMB_UNDERSCORE = TestStubs.Breadcrumb({
  id: 6,
  data: {
    from: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
    to: '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js',
  },
}) as BreadcrumbTypeNavigation;

describe('splitCrumbs', () => {
  const onClick = null;
  const startTimestampMs = 0;

  it('should accept an empty list, and print that there are zero pages', () => {
    const crumbs = [];

    const results = splitCrumbs({
      crumbs,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(1);

    render(results[0]);
    expect(screen.getByText('0 Pages')).toBeInTheDocument();
  });

  it('should accept one crumb and return that single segment', () => {
    const crumbs = [PAGELOAD_CRUMB];

    const results = splitCrumbs({
      crumbs,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(1);

    render(results[0]);
    expect(screen.getByText('https://sourcemaps.io/')).toBeInTheDocument();
  });

  it('should accept three crumbs and return them all as individual segments', () => {
    const crumbs = [PAGELOAD_CRUMB, NAV_CRUMB_BOOTSTRAP, NAV_CRUMB_UNDERSCORE];

    const results = splitCrumbs({
      crumbs,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(3);

    render(results[0]);
    expect(screen.getByText('https://sourcemaps.io/')).toBeInTheDocument();

    render(results[1]);
    expect(
      screen.getByText(
        '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js'
      )
    ).toBeInTheDocument();

    render(results[2]);
    expect(
      screen.getByText(
        '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js'
      )
    ).toBeInTheDocument();
  });

  it('should accept more than three crumbs and summarize the middle ones', () => {
    const crumbs = [
      PAGELOAD_CRUMB,
      NAV_CRUMB_BOOTSTRAP,
      NAV_CRUMB_BOOTSTRAP,
      NAV_CRUMB_BOOTSTRAP,
      NAV_CRUMB_UNDERSCORE,
    ];

    const results = splitCrumbs({
      crumbs,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(3);

    render(results[0]);
    expect(screen.getByText('https://sourcemaps.io/')).toBeInTheDocument();

    render(results[1]);
    expect(screen.getByText('3 Pages')).toBeInTheDocument();

    render(results[2]);
    expect(
      screen.getByText(
        '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js'
      )
    ).toBeInTheDocument();
  });

  it('should show the summarized items on hover', async () => {
    const crumbs = [
      PAGELOAD_CRUMB,
      {...NAV_CRUMB_BOOTSTRAP, id: 1},
      {...NAV_CRUMB_BOOTSTRAP, id: 2},
      {...NAV_CRUMB_BOOTSTRAP, id: 3},
      NAV_CRUMB_UNDERSCORE,
    ];

    const results = splitCrumbs({
      crumbs,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(3);

    render(results[1]);
    expect(screen.getByText('3 Pages')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('3 Pages'));
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
  });
});
