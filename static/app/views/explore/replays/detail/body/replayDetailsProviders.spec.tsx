import {Replayer} from '@sentry/rrweb';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ReplayReader} from 'sentry/utils/replays/replayReader';
import {ReplayDetailsProviders} from 'sentry/views/explore/replays/detail/body/replayDetailsProviders';

jest.mock('@sentry/rrweb', () => ({
  ...jest.requireActual('@sentry/rrweb'),
  Replayer: jest.fn((events: unknown[], options: {root: HTMLElement}) =>
    mockReplayer(events, options)
  ),
}));

const startedAt = new Date('2023-12-25T00:00:00');

describe('ReplayDetailsProviders', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const project = ProjectFixture({id: '2', slug: 'project-slug'});

  let markAsViewedMock: jest.Mock;

  function makeReader({
    attachments = RRWebInitFrameEventsFixture({timestamp: startedAt}),
    fetching = false,
    replayId = 'test-replay-id',
  }: {attachments?: unknown[]; fetching?: boolean; replayId?: string} = {}) {
    return ReplayReader.factory({
      attachments,
      errors: [],
      fetching,
      replayRecord: ReplayRecordFixture({
        id: replayId,
        project_id: project.id,
        started_at: startedAt,
        has_viewed: replayId !== 'test-replay-id',
      }),
    })!;
  }

  beforeEach(() => {
    jest.mocked(Replayer).mockClear();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/replays/test-replay-id/viewed-by/',
      body: {viewed_by: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: {},
    });
    markAsViewedMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/replays/test-replay-id/viewed-by/',
      method: 'POST',
      body: {},
    });
  });

  it('marks the replay viewed once when the reader is rebuilt', async () => {
    const {rerender} = render(
      <ReplayDetailsProviders replay={makeReader()} projectSlug={project.slug}>
        <div>children</div>
      </ReplayDetailsProviders>,
      {organization}
    );
    await screen.findByText('children');

    rerender(
      <ReplayDetailsProviders replay={makeReader()} projectSlug={project.slug}>
        <div>children</div>
      </ReplayDetailsProviders>
    );
    await screen.findByText('children');

    expect(markAsViewedMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'still loading',
      attachments: RRWebInitFrameEventsFixture({
        timestamp: startedAt,
        href: 'http://localhost/other',
      }),
      fetching: true,
    },
    {name: 'loaded without enough frames', attachments: [], fetching: false},
  ])(
    'does not build a player after navigating to a replay that is $name',
    async ({attachments, fetching}) => {
      const {rerender} = render(
        <ReplayDetailsProviders replay={makeReader()} projectSlug={project.slug}>
          <TestPlayer />
          <div>children</div>
        </ReplayDetailsProviders>,
        {organization}
      );
      await screen.findByText('children');
      expect(Replayer).toHaveBeenCalledTimes(1);

      const nextReplay = makeReader({
        attachments,
        fetching,
        replayId: 'other-replay-id',
      });
      rerender(
        <ReplayDetailsProviders replay={nextReplay} projectSlug={project.slug}>
          <TestPlayer />
          <div>children</div>
        </ReplayDetailsProviders>
      );

      expect(await screen.findByText('children')).toBeInTheDocument();
      expect(Replayer).toHaveBeenCalledTimes(1);
    }
  );
});

function TestPlayer() {
  const {setRoot} = useReplayContext();
  return <div ref={setRoot} />;
}

function mockReplayer(events: unknown[], {root}: {root: HTMLElement}) {
  // Mirrors the real rrweb constructor guard
  if (events.length < 2) {
    throw new Error('Replayer need at least 2 events.');
  }
  const wrapper = document.createElement('div');
  root.appendChild(wrapper);
  return {
    config: {skipInactive: false, speed: 1},
    destroy: jest.fn(),
    getCurrentTime: () => 0,
    getMirror: () => null,
    iframe: document.createElement('iframe'),
    on: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    setConfig: jest.fn(),
    wrapper,
  };
}
