import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import splitCrumbs from 'sentry/components/replays/walker/splitCrumbs';
import hydrateBreadcrumbs, {
  replayInitBreadcrumb,
} from 'sentry/utils/replays/hydrateBreadcrumbs';

const replayRecord = TestStubs.ReplayRecord({});

const INIT_FRAME = replayInitBreadcrumb(replayRecord);

const [BOOTSTRAP_FRAME, UNDERSCORE_FRAME] = hydrateBreadcrumbs(replayRecord, [
  TestStubs.Replay.NavFrame({
    timestamp: new Date(),
    data: {
      from: '/',
      to: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
    },
  }),
  TestStubs.Replay.NavFrame({
    timestamp: new Date(),
    data: {
      from: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
      to: '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js',
    },
  }),
]);

describe('splitCrumbs', () => {
  const onClick = null;
  const startTimestampMs = 0;

  it('should accept an empty list, and print that there are zero pages', () => {
    const frames = [];

    const results = splitCrumbs({
      frames,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(1);

    render(results[0]);
    expect(screen.getByText('0 Pages')).toBeInTheDocument();
  });

  it('should accept one crumb and return that single segment', () => {
    const frames = [INIT_FRAME];

    const results = splitCrumbs({
      frames,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(1);

    render(results[0]);
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('should accept three crumbs and return them all as individual segments', () => {
    const frames = [INIT_FRAME, BOOTSTRAP_FRAME, UNDERSCORE_FRAME];

    const results = splitCrumbs({
      frames,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(3);

    render(results[0]);
    expect(screen.getByText('/')).toBeInTheDocument();

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
    const frames = [
      INIT_FRAME,
      BOOTSTRAP_FRAME,
      BOOTSTRAP_FRAME,
      BOOTSTRAP_FRAME,
      UNDERSCORE_FRAME,
    ];

    const results = splitCrumbs({
      frames,
      onClick,
      startTimestampMs,
    });
    expect(results).toHaveLength(3);

    render(results[0]);
    expect(screen.getByText('/')).toBeInTheDocument();

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
    const frames = [
      INIT_FRAME,
      BOOTSTRAP_FRAME,
      BOOTSTRAP_FRAME,
      BOOTSTRAP_FRAME,
      UNDERSCORE_FRAME,
    ];

    const results = splitCrumbs({
      frames,
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
