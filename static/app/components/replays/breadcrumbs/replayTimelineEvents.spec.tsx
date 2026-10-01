import {Fragment, useState} from 'react';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {ReplayClickFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {hydrateBreadcrumbs} from 'sentry/utils/replays/hydrateBreadcrumbs';

import {ReplayTimelineEvents} from './replayTimelineEvents';

describe('ReplayTimelineEvents', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({}),
    });
  });

  it('only loads Seer setup when timeline events are present', async () => {
    const getSeerSetup = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({}),
    });
    const record = ReplayRecordFixture();
    const frames = hydrateBreadcrumbs(record, [
      ReplayClickFrameFixture({timestamp: record.started_at}),
    ]);
    const props = {
      durationMs: 60000,
      startTimestampMs: record.started_at.getTime(),
      width: 600,
    };
    const {rerender} = render(<ReplayTimelineEvents {...props} frames={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(getSeerSetup).not.toHaveBeenCalled();

    rerender(<ReplayTimelineEvents {...props} frames={frames} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    await waitFor(() => expect(getSeerSetup).toHaveBeenCalledTimes(1));

    rerender(<ReplayTimelineEvents {...props} frames={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(getSeerSetup).toHaveBeenCalledTimes(1);
  });

  it('does not add query subscriptions as timeline columns are added', async () => {
    const record = ReplayRecordFixture();
    const frames = hydrateBreadcrumbs(
      record,
      Array.from({length: 60}, (_, index) =>
        ReplayClickFrameFixture({
          timestamp: new Date(record.started_at.getTime() + index * 1000),
        })
      )
    );
    function Timeline() {
      const [expanded, setExpanded] = useState(false);
      return (
        <Fragment>
          <button onClick={() => setExpanded(true)}>Show all events</button>
          <ReplayTimelineEvents
            durationMs={60000}
            frames={expanded ? frames : frames.slice(0, 1)}
            startTimestampMs={record.started_at.getTime()}
            width={600}
          />
        </Fragment>
      );
    }
    const addEventListener = jest.spyOn(window, 'addEventListener');
    try {
      // Use the real adapter to guard the native popstate listener fan-out.
      render(<Timeline />, {additionalWrapper: NuqsAdapter});
      const initialSubscriptions = addEventListener.mock.calls.filter(
        ([name]) => String(name) === 'popstate'
      ).length;
      expect(initialSubscriptions).toBeGreaterThan(0);
      await userEvent.click(screen.getByRole('button', {name: 'Show all events'}));
      expect(
        addEventListener.mock.calls.filter(([name]) => String(name) === 'popstate')
      ).toHaveLength(initialSubscriptions);
    } finally {
      addEventListener.mockRestore();
    }
  });

  it('switches tabs and clears filters when clicking a tooltip breadcrumb', async () => {
    const record = ReplayRecordFixture();
    const frames = hydrateBreadcrumbs(record, [
      ReplayClickFrameFixture({timestamp: record.started_at}),
    ]);
    const {router} = render(
      <ReplayTimelineEvents
        durationMs={60000}
        frames={frames}
        startTimestampMs={record.started_at.getTime()}
        width={600}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {t_main: 'network', n_detail_row: '0', f_n_search: 'fetch'},
          },
        },
      }
    );
    await userEvent.hover(screen.getByRole('button'));
    await userEvent.click(await screen.findByText('User Click'));
    await waitFor(() => expect(router.location.query).toEqual({t_main: 'breadcrumbs'}));
  });
});
