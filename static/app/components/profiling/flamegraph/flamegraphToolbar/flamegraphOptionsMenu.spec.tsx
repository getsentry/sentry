import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';

import {FlamegraphOptionsMenu} from './flamegraphOptionsMenu';

function ContinuousOptionsMenu() {
  return (
    <FlamegraphStateProvider initialState={{}}>
      <FlamegraphOptionsMenu
        canvasPoolManager={new CanvasPoolManager()}
        profileType="continuous profile"
      />
    </FlamegraphStateProvider>
  );
}

describe('FlamegraphOptionsMenu', () => {
  it('links to the adjacent 30 minute windows while keeping other params', () => {
    render(<ContinuousOptionsMenu />, {
      initialRouterConfig: {
        location: {
          pathname: '/explore/profiling/profile/project/flamegraph/',
          query: {
            profilerId: 'abc',
            start: '2025-01-01T12:00:00.000Z',
            end: '2025-01-01T13:00:00.000Z',
            eventId: 'def',
          },
        },
      },
    });

    expect(
      screen.getByRole('button', {name: 'View Previous 30 Minutes'})
    ).toHaveAttribute(
      'href',
      '/explore/profiling/profile/project/flamegraph/?end=2025-01-01T13:00:00.000Z&eventId=def&profilerId=abc&start=2025-01-01T11:30:00.000Z'
    );
    expect(screen.getByRole('button', {name: 'View Next 30 Minutes'})).toHaveAttribute(
      'href',
      '/explore/profiling/profile/project/flamegraph/?end=2025-01-01T13:30:00.000Z&eventId=def&profilerId=abc&start=2025-01-01T12:00:00.000Z'
    );
  });

  it('hides the window links when the URL has no profiler window', () => {
    render(<ContinuousOptionsMenu />, {
      initialRouterConfig: {
        location: {
          pathname: '/explore/profiling/profile/project/flamegraph/',
          query: {profilerId: 'abc', start: '2025-01-01T12:00:00.000Z'},
        },
      },
    });

    expect(
      screen.queryByRole('button', {name: 'View Previous 30 Minutes'})
    ).not.toBeInTheDocument();
  });
});
