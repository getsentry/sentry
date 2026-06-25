import {duration} from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render as baseRender, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {ReplayReader} from 'sentry/utils/replays/replayReader';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {GroupReplaysPlayer} from './groupReplaysPlayer';

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
  const organization = OrganizationFixture({slug: mockOrgSlug, ...orgParams});

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

  it('shows a retryable error when the recording-segment fetch fails', async () => {
    const onRetry = jest.fn();

    render(
      <GroupReplaysPlayer
        {...defaultProps}
        handleBackClick={undefined}
        handleForwardClick={undefined}
        replayReaderResult={{
          ...defaultProps.replayReaderResult,
          attachmentError: [
            new RequestError('GET', '/recording-segments/', new Error('boom'), {
              status: 500,
              statusText: '',
              responseText: '',
              responseJSON: {detail: 'boom'},
              getResponseHeader: () => null,
            }),
          ],
          isError: true,
          status: 'error' as const,
          onRetry,
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(onRetry).toHaveBeenCalled();
  });
});
