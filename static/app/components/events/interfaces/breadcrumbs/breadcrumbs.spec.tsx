import selectEvent from 'react-select-event';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Breadcrumbs} from 'sentry/components/events/interfaces/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
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

jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

const mockReplay = ReplayReader.factory({
  replayRecord: TestStubs.ReplayRecord({}),
  errors: [],
  attachments: TestStubs.ReplaySegmentInit({}),
});

const mockUseReplayReader = useReplayReader as jest.MockedFunction<
  typeof useReplayReader
>;

mockUseReplayReader.mockImplementation(() => {
  return {
    attachments: [],
    errors: [],
    fetchError: undefined,
    fetching: false,
    onRetry: jest.fn(),
    projectSlug: TestStubs.Project().slug,
    replay: mockReplay,
    replayId: TestStubs.ReplayRecord({}).id,
    replayRecord: TestStubs.ReplayRecord(),
  };
});

describe('Breadcrumbs', () => {
  let props: React.ComponentProps<typeof Breadcrumbs>;

  const MockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

  const MockUseReplayOnboardingSidebarPanel =
    useReplayOnboardingSidebarPanel as jest.MockedFunction<
      typeof useReplayOnboardingSidebarPanel
    >;

  const MockUseHasOrganizationSentAnyReplayEvents =
    useHasOrganizationSentAnyReplayEvents as jest.MockedFunction<
      typeof useHasOrganizationSentAnyReplayEvents
    >;

  beforeEach(() => {
    const project = TestStubs.Project({platform: 'javascript'});

    MockUseProjects.mockReturnValue({
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

    props = {
      organization: TestStubs.Organization(),
      projectSlug: 'project-slug',
      isShare: false,
      event: TestStubs.Event({entries: [], projectID: project.id}),
      data: {
        values: [
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'hey',
            category: 'error',
            level: BreadcrumbLevelType.INFO,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'hello',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'bye',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'ok',
            category: 'error',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.INFO,
            type: BreadcrumbType.INFO,
          },
        ],
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            title: '/settings/',
            'project.name': 'javascript',
            id: 'abcdabcdabcdabcdabcdabcdabcdabcd',
          },
        ],
        meta: {},
      },
    });
  });

  describe('filterCrumbs', function () {
    it('should filter crumbs based on crumb message', async function () {
      render(<Breadcrumbs {...props} />);

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'hi');

      expect(
        await screen.findByText('Sorry, no breadcrumbs match your search query')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Clear'));

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'up');

      expect(
        screen.queryByText('Sorry, no breadcrumbs match your search query')
      ).not.toBeInTheDocument();

      expect(screen.getAllByText(textWithMarkupMatcher('sup'))).toHaveLength(3);
    });

    it('should filter crumbs based on crumb level', async function () {
      render(<Breadcrumbs {...props} />);

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'war');

      // breadcrumbs + filter item
      // TODO(Priscila): Filter should not render in the dom if not open
      expect(screen.getAllByText(textWithMarkupMatcher('Warning'))).toHaveLength(5);
    });

    it('should filter crumbs based on crumb category', async function () {
      render(<Breadcrumbs {...props} />);

      await userEvent.type(screen.getByPlaceholderText('Search breadcrumbs'), 'error');

      expect(screen.getAllByText(textWithMarkupMatcher('error'))).toHaveLength(2);
    });
  });

  describe('render', function () {
    it('should display the correct number of crumbs with no filter', function () {
      props.data.values = props.data.values.slice(0, 4);

      render(<Breadcrumbs {...props} />);

      // data.values + virtual crumb
      expect(screen.getAllByTestId('crumb')).toHaveLength(4);

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should display the correct number of crumbs with a filter', async function () {
      props.data.values = props.data.values.slice(0, 4);

      render(<Breadcrumbs {...props} />);

      const searchInput = screen.getByPlaceholderText('Search breadcrumbs');

      await userEvent.type(searchInput, 'sup');

      expect(screen.queryByTestId('crumb')).not.toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should not crash if data contains a toString attribute', function () {
      // Regression test: A "toString" property in data should not falsely be
      // used to coerce breadcrumb data to string. This would cause a TypeError.
      const data = {nested: {toString: 'hello'}};

      props.data.values = [
        {
          message: 'sup',
          category: 'default',
          level: BreadcrumbLevelType.INFO,
          type: BreadcrumbType.INFO,
          data,
        },
      ];

      render(<Breadcrumbs {...props} />);

      // data.values + virtual crumb
      expect(screen.getByTestId('crumb')).toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should render Sentry Transactions crumb', async function () {
      props.data.values = [
        {
          message: '12345678123456781234567812345678',
          category: 'sentry.transaction',
          level: BreadcrumbLevelType.INFO,
          type: BreadcrumbType.TRANSACTION,
        },
        {
          message: 'abcdabcdabcdabcdabcdabcdabcdabcd',
          category: 'sentry.transaction',
          level: BreadcrumbLevelType.INFO,
          type: BreadcrumbType.TRANSACTION,
        },
      ];

      render(<Breadcrumbs {...props} />);

      // Transaction not in response should show as non-clickable id
      expect(
        await screen.findByText('12345678123456781234567812345678')
      ).toBeInTheDocument();

      expect(screen.getByText('12345678123456781234567812345678')).not.toHaveAttribute(
        'href'
      );

      // Transaction in response should show as clickable title
      expect(await screen.findByRole('link', {name: '/settings/'})).toBeInTheDocument();

      expect(screen.getByText('/settings/')).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance/project-slug:abcdabcdabcdabcdabcdabcdabcdabcd/?referrer=breadcrumbs'
      );
    });
  });

  describe('replay', () => {
    it('should render the replay inline onboarding component when replays are enabled and the project supports replay', async function () {
      MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
        hasOrgSentReplays: false,
        fetching: false,
      });
      MockUseReplayOnboardingSidebarPanel.mockReturnValue({
        activateSidebar: jest.fn(),
      });
      const {container} = render(
        <Breadcrumbs
          {...props}
          event={TestStubs.Event({
            entries: [],
            tags: [],
            platform: 'javascript',
          })}
          organization={TestStubs.Organization({
            features: ['session-replay'],
          })}
        />
      );

      expect(await screen.findByText('Configure Session Replay')).toBeInTheDocument();
      expect(container).toSnapshot();
    });

    it('should not render the replay inline onboarding component when the project is not JS', async function () {
      MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
        hasOrgSentReplays: false,
        fetching: false,
      });
      MockUseReplayOnboardingSidebarPanel.mockReturnValue({
        activateSidebar: jest.fn(),
      });
      const {container} = render(
        <Breadcrumbs
          {...props}
          event={TestStubs.Event({
            entries: [],
            tags: [],
          })}
          organization={TestStubs.Organization({
            features: ['session-replay'],
          })}
        />
      );

      expect(
        await screen.queryByText('Configure Session Replay')
      ).not.toBeInTheDocument();
      expect(await screen.queryByTestId('player-container')).not.toBeInTheDocument();
      expect(container).toSnapshot();
    });

    it('should render a replay when there is a replayId from tags', async function () {
      MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
        hasOrgSentReplays: true,
        fetching: false,
      });
      MockUseReplayOnboardingSidebarPanel.mockReturnValue({
        activateSidebar: jest.fn(),
      });
      const {container} = render(
        <Breadcrumbs
          {...props}
          event={TestStubs.Event({
            entries: [],
            tags: [{key: 'replayId', value: '761104e184c64d439ee1014b72b4d83b'}],
            platform: 'javascript',
          })}
          organization={TestStubs.Organization({
            features: ['session-replay'],
          })}
        />
      );

      expect(await screen.findByTestId('player-container')).toBeInTheDocument();
      expect(container).toSnapshot();
    });

    it('should render a replay when there is a replay_id from contexts', async function () {
      MockUseHasOrganizationSentAnyReplayEvents.mockReturnValue({
        hasOrgSentReplays: true,
        fetching: false,
      });
      MockUseReplayOnboardingSidebarPanel.mockReturnValue({
        activateSidebar: jest.fn(),
      });
      const {container} = render(
        <Breadcrumbs
          {...props}
          event={TestStubs.Event({
            entries: [],
            tags: [],
            contexts: {
              replay: {
                replay_id: '761104e184c64d439ee1014b72b4d83b',
              },
            },
            platform: 'javascript',
          })}
          organization={TestStubs.Organization({
            features: ['session-replay'],
          })}
        />
      );

      expect(await screen.findByTestId('player-container')).toBeInTheDocument();
      expect(container).toSnapshot();
    });

    it('can change the sort', async function () {
      render(
        <Breadcrumbs
          {...props}
          data={{
            values: [
              {
                message: 'sup',
                category: 'default',
                level: BreadcrumbLevelType.WARNING,
                type: BreadcrumbType.INFO,
              },
              {
                message: 'hey',
                category: 'error',
                level: BreadcrumbLevelType.INFO,
                type: BreadcrumbType.INFO,
              },
              {
                message: 'hello',
                category: 'default',
                level: BreadcrumbLevelType.WARNING,
                type: BreadcrumbType.INFO,
              },
            ],
          }}
        />
      );
      const breadcrumbsBefore = screen.getAllByTestId(/crumb/i);
      expect(breadcrumbsBefore).toHaveLength(4); // Virtual exception crumb added to 3 in props

      // Should be sorted newest -> oldest by default
      expect(within(breadcrumbsBefore[0]!).getByText(/exception/i)).toBeInTheDocument();
      expect(within(breadcrumbsBefore[1]!).getByText('hello')).toBeInTheDocument();
      expect(within(breadcrumbsBefore[2]!).getByText('hey')).toBeInTheDocument();
      expect(within(breadcrumbsBefore[3]!).getByText('sup')).toBeInTheDocument();

      await selectEvent.select(screen.getByText(/newest/i), /oldest/i);

      // Now should be sorted oldest -> newest
      const breadcrumbsAfter = screen.getAllByTestId(/crumb/i);
      expect(within(breadcrumbsAfter[0]!).getByText('sup')).toBeInTheDocument();
      expect(within(breadcrumbsAfter[1]!).getByText('hey')).toBeInTheDocument();
      expect(within(breadcrumbsAfter[2]!).getByText('hello')).toBeInTheDocument();
      expect(within(breadcrumbsAfter[3]!).getByText(/exception/i)).toBeInTheDocument();
    });
  });
});
