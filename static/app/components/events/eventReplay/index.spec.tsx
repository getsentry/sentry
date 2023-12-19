import {Event as EventFixture} from 'sentry-fixture/event';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEvents} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventReplay from 'sentry/components/events/eventReplay';
import {
  useHasOrganizationSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import ReplayReader from 'sentry/utils/replays/replayReader';
import useProjects from 'sentry/utils/useProjects';

jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useReplayReader');
jest.mock('sentry/utils/useProjects');

const now = new Date();
const mockReplay = ReplayReader.factory(
  {
    replayRecord: ReplayRecordFixture({started_at: now}),
    errors: [],
    attachments: RRWebInitFrameEvents({timestamp: now}),
  },
  {}
);

jest.mocked(useReplayReader).mockImplementation(() => {
  return {
    attachments: [],
    errors: [],
    fetchError: undefined,
    fetching: false,
    onRetry: jest.fn(),
    projectSlug: ProjectFixture().slug,
    replay: mockReplay,
    replayId: ReplayRecordFixture({}).id,
    replayRecord: ReplayRecordFixture(),
  };
});

describe('EventReplay', function () {
  const MockUseReplayOnboardingSidebarPanel = jest.mocked(
    useReplayOnboardingSidebarPanel
  );

  const MockUseHasOrganizationSentAnyReplayEvents = jest.mocked(
    useHasOrganizationSentAnyReplayEvents
  );

  const organization = Organization({
    features: ['session-replay'],
  });

  const defaultProps = {
    event: EventFixture({
      entries: [],
      tags: [],
      platform: 'javascript',
    }),
    projectSlug: 'project-slug',
  };

  beforeEach(function () {
    const project = ProjectFixture({platform: 'javascript'});

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

    expect(await screen.findByText('Configure Session Replay')).toBeInTheDocument();
  });

  it('should not render the replay inline onboarding component when the project is not JS', function () {
    MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
      hasOrgSentReplays: false,
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
        })}
      />,
      {organization}
    );

    expect(screen.queryByText('Configure Session Replay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('player-container')).not.toBeInTheDocument();
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
});
