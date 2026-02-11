import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RawReplayErrorFixture} from 'sentry-fixture/replay/error';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventReplay from 'sentry/components/events/eventReplay';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {
  useHaveSelectedProjectsSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import ReplayReader from 'sentry/utils/replays/replayReader';
import type {RawReplayError} from 'sentry/utils/replays/types';

jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useLoadReplayReader');
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

const mockErrors: RawReplayError[] = [
  RawReplayErrorFixture({
    id: '1',
    issue: 'JAVASCRIPT-101',
    'issue.id': 101,
    'error.type': ['error'],
    'project.name': 'javascript',
    timestamp: mockEventTimestamp,
    title: 'Something bad happened.',
  }),
  RawReplayErrorFixture({
    id: '2',
    issue: 'JAVASCRIPT-102',
    'issue.id': 102,
    'error.type': ['error'],
    'project.name': 'javascript',
    timestamp: mockEventTimestamp,
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
    attachmentError: undefined,
    isError: false,
    isPending: false,
    onRetry: jest.fn(),
    projectSlug: ProjectFixture().slug,
    replay: mockReplay,
    replayId: mockReplayId,
    replayRecord: ReplayRecordFixture(),
    status: 'success' as const,
  };
});

describe('EventReplay', () => {
  const MockUseReplayOnboardingSidebarPanel = jest.mocked(
    useReplayOnboardingSidebarPanel
  );

  const MockUseHaveSelectedProjectsSentAnyReplayEvents = jest.mocked(
    useHaveSelectedProjectsSentAnyReplayEvents
  );

  const user = UserFixture({id: '1'});
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

  beforeEach(() => {
    ConfigStore.set('user', user);
    const project = ProjectFixture({platform: 'javascript'});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    ProjectsStore.loadInitialData([project]);

    MockUseReplayOnboardingSidebarPanel.mockReturnValue({
      activateSidebar: jest.fn(),
    });
    MockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      hasSentOneReplay: false,
      fetching: false,
    });
  });

  it('should render the replay inline onboarding component when replays are enabled and the project supports replay', async () => {
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

  it('should render a replay when there is a replayId from tags', async () => {
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

  it('should render a replay when there is a replay_id from contexts', async () => {
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

  it('should not render replay when user does not have granular replay permissions', () => {
    const orgWithGranularPermissions = OrganizationFixture({
      features: ['session-replay', 'granular-replay-permissions'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999], // User ID 1 is not in this list
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithGranularPermissions.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

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
      {organization: orgWithGranularPermissions}
    );

    expect(screen.queryByTestId('replay-clip')).not.toBeInTheDocument();
  });
});
