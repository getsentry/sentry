import {duration} from 'moment-timezone';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render as baseRender, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import ReplayReader from 'sentry/utils/replays/replayReader';

import GroupReplaysPlayer from './groupReplaysPlayer';

jest.mock('sentry/utils/replays/hooks/useLoadReplayReader');

const mockOrgSlug = 'sentry-emerging-tech';
const mockReplaySlug = 'replays:761104e184c64d439ee1014b72b4d83b';
const mockReplayId = '761104e184c64d439ee1014b72b4d83b';

const mockEventTimestamp = new Date('2022-09-22T16:59:41Z');
const mockEventTimestampMs = mockEventTimestamp.getTime();

const mockIsFullscreen = jest.fn();

const mockReplay = ReplayReader.factory({
  replayRecord: ReplayRecordFixture({
    browser: {
      name: 'Chrome',
      version: '110.0.0',
    },
    started_at: new Date('Sep 22, 2022 4:58:39 PM UTC'),
    finished_at: new Date(mockEventTimestampMs + 5_000),
    duration: duration(10, 'seconds'),
  }),
  errors: [],
  fetching: false,
  attachments: RRWebInitFrameEventsFixture({
    timestamp: new Date('Sep 22, 2022 4:58:39 PM UTC'),
  }),
  clipWindow: {
    startTimestampMs: mockEventTimestampMs - 5_000,
    endTimestampMs: mockEventTimestampMs + 5_000,
  },
});

const render = (children: React.ReactElement, orgParams: Partial<Organization> = {}) => {
  const {organization} = initializeOrg({
    organization: {slug: mockOrgSlug, ...orgParams},
    router: {
      routes: [
        {path: '/'},
        {path: '/organizations/:orgId/issues/:groupId/'},
        {path: 'replays/'},
      ],
      location: {
        pathname: '/organizations/org-slug/replays/',
        query: {},
      },
    },
  });

  return baseRender(children, {
    organization,
  });
};

describe('GroupReplaysPlayer', () => {
  beforeEach(() => {
    mockIsFullscreen.mockReturnValue(false);

    MockApiClient.addMockResponse({
      url: '/organizations/sentry-emerging-tech/projects/',
      body: [],
    });
  });

  const defaultProps = {
    analyticsContext: '',
    orgSlug: mockOrgSlug,
    replaySlug: mockReplaySlug,
    eventTimestampMs: mockEventTimestampMs,
    clipOffsets: {
      durationAfterMs: 5_000,
      durationBeforeMs: 5_000,
    },
    fullReplayButtonProps: {},
    overlayContent: null,
    replayReaderResult: {
      attachmentError: undefined,
      attachments: [],
      errors: [],
      fetchError: undefined,
      isError: false,
      isPending: false,
      onRetry: jest.fn(),
      projectSlug: ProjectFixture().slug,
      replay: mockReplay,
      replayId: mockReplayId,
      replayRecord: ReplayRecordFixture(),
      status: 'success' as const,
    },
  };

  it('Render the back and forward buttons when we pass in showNextAndPrevious', async () => {
    const handleBackClick = jest.fn();
    const handleForwardClick = jest.fn();

    render(
      <GroupReplaysPlayer
        {...defaultProps}
        handleBackClick={handleBackClick}
        handleForwardClick={handleForwardClick}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Previous Clip'}));
    expect(handleBackClick).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Next Clip'}));
    expect(handleForwardClick).toHaveBeenCalled();
  });
});
