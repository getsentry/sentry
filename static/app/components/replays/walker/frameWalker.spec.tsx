import {render, screen} from 'sentry-test/reactTestingLibrary';

import FrameWalker from 'sentry/components/replays/walker/frameWalker';
import hydrateBreadcrumbs, {
  replayInitBreadcrumb,
} from 'sentry/utils/replays/hydrateBreadcrumbs';

describe('FrameWalker', () => {
  const replayRecord = TestStubs.ReplayRecord({});

  it('should accept a list of crumbs and render a <ChevronDividedList />', () => {
    const init = replayInitBreadcrumb(replayRecord);
    const breadcrumbs = hydrateBreadcrumbs(replayRecord, [
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
          from: '/',
          to: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
        },
      }),
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
    const frames = [init, ...breadcrumbs];

    render(<FrameWalker frames={frames} replayRecord={replayRecord} />);

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('3 Pages')).toBeInTheDocument();
    expect(
      screen.getByText(
        '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js'
      )
    ).toBeInTheDocument();
  });
});
