import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayErrorFixture} from 'sentry-fixture/replayError';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import EventReplay from 'sentry/components/events/eventReplay';
import ConfigStore from 'sentry/stores/configStore';
import {
  useHasOrganizationSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import ReplayReader from 'sentry/utils/replays/replayReader';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayError} from 'sentry/views/replays/types';

jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useReplayReader');
jest.mock('sentry/utils/useProjects');

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
  attachments: RRWebInitFrameEventsFixture({
    timestamp: new Date('Sep 22, 2022 4:58:39 PM UTC'),
  }),
});

jest.mocked(useReplayReader).mockImplementation(() => {
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

const mockIsFullscreen = jest.fn();

jest.mock('screenfull', () => ({
  enabled: true,
  get isFullscreen() {
    return mockIsFullscreen();
  },
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

describe('EventReplay', function () {
  const MockUseReplayOnboardingSidebarPanel = jest.mocked(
    useReplayOnboardingSidebarPanel
  );

  const MockUseHasOrganizationSentAnyReplayEvents = jest.mocked(
    useHasOrganizationSentAnyReplayEvents
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
      placeholders: [],
      projects: [project],
    });
    MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
      hasOrgSentReplays: false,
      fetching: false,
    });
    MockUseReplayOnboardingSidebarPanel.mockReturnValue({
      activateSidebar: jest.fn(),
    });
  });

  it('should render the replay inline onboarding component when replays are enabled and the project supports replay', async function () {
    MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
      hasOrgSentReplays: false,
      fetching: false,
    });
    MockUseReplayOnboardingSidebarPanel.mockReturnValue({
      activateSidebar: jest.fn(),
    });
    render(<EventReplay {...defaultProps} />, {organization});

    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();
  });

  it('should render a replay when there is a replayId from tags', async function () {
    MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
      hasOrgSentReplays: true,
      fetching: false,
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
      {organization}
    );

    expect(await screen.findByTestId('player-container')).toBeInTheDocument();
  });

  it('should render a replay when there is a replay_id from contexts', async function () {
    MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
      hasOrgSentReplays: true,
      fetching: false,
    });
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

    expect(await screen.findByTestId('player-container')).toBeInTheDocument();
  });

  describe('replay clip', function () {
    const orgWithClipFlag = OrganizationFixture({
      features: [...organization.features, 'issue-details-inline-replay-viewer'],
    });

    beforeEach(() => {
      MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
        hasOrgSentReplays: true,
        fetching: false,
      });
      MockUseReplayOnboardingSidebarPanel.mockReturnValue({
        activateSidebar: jest.fn(),
      });

      const user = ConfigStore.get('user');

      ConfigStore.set('user', {
        ...user,
        options: {...user.options, issueDetailsNewExperienceQ42023: true},
      });
    });

    it('adds event and issue information to breadcrumbs', async () => {
      mockIsFullscreen.mockReturnValue(true);

      render(
        <EventReplay
          {...defaultProps}
          event={EventFixture({
            ...mockEvent,
            id: '1',
            contexts: {
              replay: {
                replay_id: '761104e184c64d439ee1014b72b4d83b',
              },
            },
          })}
          group={GroupFixture({id: '101'})}
        />,
        {
          organization: orgWithClipFlag,
        }
      );

      // Event that matches ID 1 should be shown as "This Event"
      await waitFor(
        () => {
          expect(screen.getByText('Error: This Event')).toBeInTheDocument();
        },
        {timeout: 3000, interval: 100}
      );
      expect(screen.getByText('JAVASCRIPT-101')).toBeInTheDocument();

      // Other events should link to the event and issue
      expect(screen.getByRole('link', {name: '2'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/102/events/2/#replay'
      );
      expect(screen.getByRole('link', {name: 'JAVASCRIPT-102'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/102/'
      );
    });
  });
});
