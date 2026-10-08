import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {trackAnalytics} from 'sentry/utils/analytics';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {FlamegraphProvider} from 'sentry/views/explore/profiling/flamegraphProvider';
import {ProfileGroupProvider} from 'sentry/views/explore/profiling/profileGroupProvider';

jest.mock('sentry/utils/analytics');

const sampledProfile: Profiling.SampledProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 30,
  threadID: 0,
  unit: 'nanoseconds',
  type: 'sampled',
  weights: [10, 10, 10],
  samples: [
    [0, 1],
    [0, 1],
    [0, 2],
  ],
};

const input: Profiling.Schema = {
  activeProfileIndex: 0,
  profileID: '',
  profiles: [sampledProfile],
  projectID: 1,
  shared: {
    frames: [{name: 'root'}, {name: 'busy'}, {name: 'idle'}],
  },
  metadata: {} as Profiling.Schema['metadata'],
};

function renderTreeTable() {
  const canvasPoolManager = new CanvasPoolManager();

  render(
    <ProfileGroupProvider input={input} traceID="" type="flamegraph">
      <FlamegraphStateProvider initialState={{preferences: {sorting: 'left heavy'}}}>
        <FlamegraphThemeProvider>
          <FlamegraphProvider>
            <AggregateFlamegraphTreeTable
              canvasPoolManager={canvasPoolManager}
              canvasScheduler={new CanvasScheduler()}
              frameFilter="all"
              profileType="landing aggregate calltree"
              recursion={null}
            />
          </FlamegraphProvider>
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );

  return {canvasPoolManager};
}

describe('AggregateFlamegraphTreeTable', () => {
  it('renders the sample count and average duration columns when given a profile', async () => {
    renderTreeTable();

    const row = await screen.findByRole('row', {name: /busy/});

    expect(screen.getByRole('columnheader', {name: /Samples/})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: /Average Duration/})
    ).toBeInTheDocument();
    expect(
      within(within(row).getAllByRole('gridcell')[0]!).getByText('20')
    ).toBeInTheDocument();
    expect(row).toHaveAttribute('aria-level', '1');
  });

  it('highlights the frame on the flamegraph and tracks the click when a row is clicked', async () => {
    const {canvasPoolManager} = renderTreeTable();
    const dispatch = jest.spyOn(canvasPoolManager, 'dispatch');

    await userEvent.click(await screen.findByRole('row', {name: /busy/}));

    expect(dispatch).toHaveBeenCalledWith('highlight frame', [
      [expect.objectContaining({frame: expect.objectContaining({name: 'busy'})})],
      'selected',
    ]);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'profiling_views.flamegraph.click.highlight_frame',
      expect.objectContaining({profile_type: 'landing aggregate calltree'})
    );
    expect(screen.getByRole('row', {name: /busy/})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
