import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayErrorFixture} from 'sentry-fixture/replayError';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventReplay from 'sentry/components/events/eventReplay';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {
  useHaveSelectedProjectsSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import ReplayReader from 'sentry/utils/replays/replayReader';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayError} from 'sentry/views/replays/types';

jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useLoadReplayReader');
jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
// Replay clip preview is very heavy, mock it out
jest.mock(
  'sentry/components/events/eventReplay/replayClipPreview',
  () =>
    function () {
      return <div data-test-id="replay-clip" />;
    }
);

const mockEventTimestamp = new Date('2022-09-22T16:59:41Z');
const mockReplayId = '761104e184c64d439ee1014b72b4d83b';

const mockErrors: ReplayError[] = [
  ReplayErrorFixture({
    id: '1',
    issue: 'JAVASCRIPT-101',
    'issue.id': 101,
    'error.value': ['Something bad happened.'],
    'error.type': ['error'],
    'project.name': 'javascript',
    timestamp: mockEventTimestamp.toISOString(),
    title: 'Something bad happened.',
  }),
  ReplayErrorFixture({
    id: '2',
    issue: 'JAVASCRIPT-102',
    'issue.id': 102,
    'error.value': ['Something bad happened 2.'],
    'error.type': ['error'],
    'project.name': 'javascript',
    timestamp: mockEventTimestamp.toISOString(),
    title: 'Something bad happened 2.',
  }),
];

const mockReplay = ReplayReader.factory({
  replayRecord: ReplayRecordFixture({
    browser: {
      name: 'Chrome',
      version: '110.0.0',
    },
  }),
  errors: mockErrors,
  fetching: false,
  attachments: RRWebInitFrameEventsFixture({
    timestamp: new Date('Sep 22, 2022 4:58:39 PM UTC'),
  }),
});

jest.mocked(useLoadReplayReader).mockImplementation(() => {
  return {
    attachments: [],
    errors: mockErrors,
    fetchError: undefined,
    fetching: false,
    onRetry: jest.fn(),
    projectSlug: ProjectFixture().slug,
    replay: mockReplay,
    replayId: mockReplayId,
    replayRecord: ReplayRecordFixture(),
  };
});

describe('EventReplay', function () {
  const MockUseReplayOnboardingSidebarPanel = jest.mocked(
    useReplayOnboardingSidebarPanel
  );

  const MockUseHaveSelectedProjectsSentAnyReplayEvents = jest.mocked(
    useHaveSelectedProjectsSentAnyReplayEvents
  );

  const organization = OrganizationFixture({
    features: ['session-replay'],
  });

  const mockEvent = EventFixture({
    entries: [],
    tags: [],
    platform: 'javascript',
    dateCreated: mockEventTimestamp.getTime(),
  });

  const defaultProps = {
    event: mockEvent,
    projectSlug: 'project-slug',
  };

  beforeEach(function () {
    const project = ProjectFixture({platform: 'javascript'});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    jest.mocked(useProjects).mockReturnValue({
      fetchError: null,
      fetching: false,
      hasMore: false,
      initiallyLoaded: false,
      onSearch: () => Promise.resolve(),
      reloadProjects: jest.fn(),
      placeholders: [],
      projects: [project],
    });
    MockUseReplayOnboardingSidebarPanel.mockReturnValue({
      activateSidebar: jest.fn(),
    });
    MockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      hasSentOneReplay: false,
      fetching: false,
    });
  });

  it('should render the replay inline onboarding component when replays are enabled and the project supports replay', async function () {
    MockUseReplayOnboardingSidebarPanel.mockReturnValue({
      activateSidebar: jest.fn(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
    render(<EventReplay {...defaultProps} />, {organization});

    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();
  });

  it('should render a replay when there is a replayId from tags', async function () {
    MockUseReplayOnboardingSidebarPanel.mockReturnValue({
      activateSidebar: jest.fn(),
    });
    render(
      <EventReplay
        {...defaultProps}
        event={EventFixture({
          entries: [],
          tags: [{key: 'replayId', value: '761104e184c64d439ee1014b72b4d83b'}],
          platform: 'javascript',
        })}
      />,
      {organization}
    );

    expect(await screen.findByTestId('replay-clip')).toBeInTheDocument();
  });

  it('should render a replay when there is a replay_id from contexts', async function () {
    MockUseReplayOnboardingSidebarPanel.mockReturnValue({
      activateSidebar: jest.fn(),
    });
    render(
      <EventReplay
        {...defaultProps}
        event={EventFixture({
          entries: [],
          tags: [],
          contexts: {
            replay: {
              replay_id: '761104e184c64d439ee1014b72b4d83b',
            },
          },
          platform: 'javascript',
        })}
      />,
      {organization}
    );

    expect(await screen.findByTestId('replay-clip')).toBeInTheDocument();
  });
});
