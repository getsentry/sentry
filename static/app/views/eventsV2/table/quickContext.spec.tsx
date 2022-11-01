import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import {Commit, Group, ReleaseWithHealth, Repository, User} from 'sentry/types';
import {EventData} from 'sentry/utils/discover/eventView';

import QuickContext, {ContextType, QuickContextHoverWrapper} from './quickContext';

const defaultRow: EventData = {
  id: '6b43e285de834ec5b5fe30d62d549b20',
  issue: 'SENTRY-VVY',
  release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
  title: 'error: Error -3 while decompressing data: invalid stored block lengths',
  'issue.id': 3512441874,
  'project.name': 'sentry',
};

let mockedGroup = TestStubs.Group({
  id: '3512441874',
  project: {
    id: '1',
    slug: 'cool-team',
  },
  status: 'ignored',
  assignedTo: {
    id: '12312',
    name: 'ingest',
    type: 'team',
  },
});

const mockedCommit: Commit = {
  dateCreated: '2020-11-30T18:46:31Z',
  id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
  message: 'ref(commitRow): refactor to fc\n',
  author: {
    id: '0',
    username: 'author',
    ip_address: '192.168.1.1',
    email: 'author@commit.com',
    name: 'Author',
  } as User,
  repository: {
    id: '1',
    integrationId: '2',
    name: 'getsentry/sentry',
    dateCreated: '2019-11-30T18:46:31Z',
  } as Repository,
  releases: [],
};

const mockedUser1 = {
  id: '2',
  username: 'author456',
  ip_address: '192.168.1.1',
  email: 'author1@commit.com',
  name: 'Key Name',
} as User;

const mockedUser2 = {
  id: '3',
  username: 'author123',
  ip_address: '192.168.1.3',
  email: 'author2@commit.com',
  name: 'Value Name',
} as User;

const mockedReleaseWithHealth = TestStubs.Release({
  id: '1',
  shortVersion: 'sentry-android-shop@1.2.0',
  version: 'sentry-android-shop@1.2.0',
  dateCreated: '2010-05-17T02:41:20Z',
  lastEvent: '2011-10-17T02:41:20Z',
  firstEvent: '2010-05-17T02:41:20Z',
  status: 'open',
  commitCount: 4,
  lastCommit: mockedCommit,
  newGroups: 21,
  authors: [mockedUser1, mockedUser2],
});

const renderQuickContextContent = (
  data: Group | ReleaseWithHealth | null = null,
  dataRow: EventData = defaultRow,
  contextType: ContextType = ContextType.ISSUE,
  loading: boolean = false,
  error: boolean = false
) => {
  const organization = TestStubs.Organization();
  render(
    <QuickContext
      dataRow={dataRow}
      contextType={contextType}
      error={error}
      loading={loading}
      data={data}
    />,
    {organization}
  );
};

describe('Quick Context', function () {
  describe('Quick Context Content', function () {
    describe('Quick Context Content default behaviour', function () {
      it('Loading state renders for Quick Context.', () => {
        renderQuickContextContent(null, defaultRow, ContextType.ISSUE, true);

        expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      });

      it('Error state renders for Quick Context.', () => {
        renderQuickContextContent(null, defaultRow, ContextType.ISSUE, false, true);

        expect(
          screen.getByText(/Failed to load context for column./i)
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId('quick-context-loading-indicator')
        ).not.toBeInTheDocument();
      });
    });

    describe('Quick Context Content Issue Column', function () {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/users/',
          body: [],
        });

        MockApiClient.addMockResponse({
          url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
          body: [],
        });
        jest.spyOn(GroupStore, 'get').mockImplementation(() => mockedGroup);
      });

      afterEach(function () {
        GroupStore.reset();
        MockApiClient.clearMockResponses();
      });

      describe('Quick Context for Issue Column - Status', function () {
        it('Render Ignored Issue status context when data is loaded', async () => {
          renderQuickContextContent(mockedGroup);

          expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
          expect(screen.getByText(/Ignored/i)).toBeInTheDocument();
          expect(screen.getByTestId('quick-context-ignored-icon')).toBeInTheDocument();
        });

        it('Render Resolved Issue status context when data is loaded', async () => {
          mockedGroup = {...mockedGroup, status: 'resolved'};
          renderQuickContextContent(mockedGroup);

          expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
          expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
          expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
        });

        it('Render Unresolved Issue status context when data is loaded', async () => {
          mockedGroup = {...mockedGroup, status: 'unresolved'};
          renderQuickContextContent(mockedGroup);

          expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
          expect(screen.getByText(/Unresolved/i)).toBeInTheDocument();
          expect(screen.getByTestId('quick-context-unresolved-icon')).toBeInTheDocument();
        });
      });

      describe('Quick Context for Issue Column - Assignee', function () {
        it('Render Assigned To context when data is loaded', async () => {
          renderQuickContextContent(mockedGroup);

          expect(await screen.findByText(/Assigned To/i)).toBeInTheDocument();
          expect(screen.getByText(/#ingest/i)).toBeInTheDocument();
        });
      });

      describe('Quick Context for Issue Column - Suspect Commits', function () {
        it('Does not render suspect commit to context when row lacks event id', async () => {
          const dataRowWithoutId: unknown = {
            issue: 'SENTRY-VVY',
            release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
            title:
              'error: Error -3 while decompressing data: invalid stored block lengths',
            'issue.id': 3512441874,
            'project.name': 'sentry',
          };

          renderQuickContextContent(mockedGroup, dataRowWithoutId as EventData);

          await waitFor(() => {
            expect(
              screen.queryByTestId('quick-context-suspect-commits-container')
            ).not.toBeInTheDocument();
          });
        });

        it('Renders Suspect Commits', async () => {
          MockApiClient.addMockResponse({
            method: 'GET',
            url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
            body: {
              committers: [
                {
                  author: {name: 'Max Bittker', id: '1'},
                  commits: [
                    {
                      message: 'feat: Added new feature',
                      score: 4,
                      id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
                      repository: TestStubs.Repository(),
                      dateCreated: '2018-03-02T18:30:26Z',
                      pullRequest: {
                        externalUrl: 'url',
                      },
                    },
                  ],
                },
              ],
            },
          });
          renderQuickContextContent(mockedGroup);

          expect(await screen.findByText(/Suspect Commits/i)).toBeInTheDocument();
          expect(screen.getByText(/MB/i)).toBeInTheDocument();
          expect(screen.getByText(/View commit/i)).toBeInTheDocument();
          expect(screen.getByText(/by/i)).toBeInTheDocument();
          expect(screen.getByText(/You/i)).toBeInTheDocument();
        });
      });
    });

    describe('Quick Context Content Release Column', function () {
      beforeEach(() => {
        jest.restoreAllMocks();
      });

      it('Renders Release details for active release', async () => {
        renderQuickContextContent(
          mockedReleaseWithHealth,
          defaultRow,
          ContextType.RELEASE
        );

        expect(await screen.findByText(/Release Details/i)).toBeInTheDocument();

        const definitions = screen.getAllByRole('definition');
        const terms = screen.getAllByRole('term');

        expect(within(terms[0]).getByText(/Status/i)).toBeInTheDocument();
        expect(within(definitions[0]).getByText(/Active/i)).toBeInTheDocument();
        expect(within(terms[1]).getByText(/Created/i)).toBeInTheDocument();
        expect(within(definitions[1]).getByText(/7 years ago/i)).toBeInTheDocument();
        expect(within(terms[2]).getByText(/First Event/i)).toBeInTheDocument();
        expect(within(definitions[2]).getByText(/7 years ago/i)).toBeInTheDocument();
        expect(within(terms[3]).getByText(/Last Event/i)).toBeInTheDocument();
        expect(within(definitions[3]).getByText(/6 years ago/i)).toBeInTheDocument();
      });

      it('Renders Release details for archived release', async () => {
        renderQuickContextContent(
          {...mockedReleaseWithHealth, status: 'closed'},
          defaultRow,
          ContextType.RELEASE
        );

        expect(await screen.findByText(/Release Details/i)).toBeInTheDocument();

        expect(screen.getByText(/Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Archived/i)).toBeInTheDocument();
        expect(screen.queryByText(/Created/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/First Event/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Last Event/i)).not.toBeInTheDocument();
      });

      it('Renders Last Commit', async () => {
        renderQuickContextContent(
          mockedReleaseWithHealth,
          defaultRow,
          ContextType.RELEASE
        );

        expect(await screen.findByText(/Last Commit/i)).toBeInTheDocument();
        expect(screen.getByTestId('quick-context-commit-row')).toBeInTheDocument();
      });

      it('Renders New Issues Count', async () => {
        renderQuickContextContent(
          mockedReleaseWithHealth,
          defaultRow,
          ContextType.RELEASE
        );

        expect(await screen.findByText(/New Issues/i)).toBeInTheDocument();
        expect(screen.getByText(/21/i)).toBeInTheDocument();
      });

      it('Renders Commit Count and Author when user is NOT in list of authors', async () => {
        renderQuickContextContent(
          mockedReleaseWithHealth,
          defaultRow,
          ContextType.RELEASE
        );

        expect(await screen.findByText(/4/i)).toBeInTheDocument();
        expect(screen.getByText(/commits/i)).toBeInTheDocument();
        expect(screen.getAllByText(/by/i)).toHaveLength(2);
        expect(screen.getByText(/2 authors/i)).toBeInTheDocument();
        expect(screen.getByText(/KN/i)).toBeInTheDocument();
        expect(screen.getByText(/VN/i)).toBeInTheDocument();
      });

      it('Renders Commit Count and Author when user is in list of authors', async () => {
        jest.spyOn(ConfigStore, 'get').mockImplementation(() => mockedUser1);
        renderQuickContextContent(
          mockedReleaseWithHealth,
          defaultRow,
          ContextType.RELEASE
        );

        expect(await screen.findByText(/4/i)).toBeInTheDocument();
        expect(screen.getByText(/commits/i)).toBeInTheDocument();
        expect(screen.getAllByText(/by/i)).toHaveLength(2);
        expect(screen.getByText(/you and 1 other author/i)).toBeInTheDocument();
        expect(screen.getByText(/KN/i)).toBeInTheDocument();
        expect(screen.getByText(/VN/i)).toBeInTheDocument();
      });
    });
  });

  describe('Quick Context Hover', function () {
    afterEach(() => {
      GroupStore.reset();
      MockApiClient.clearMockResponses();
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        body: [],
      });
    });

    it('Renders Child and Info Icon', async () => {
      render(
        <QuickContextHoverWrapper contextType={ContextType.ISSUE} dataRow={defaultRow}>
          Text from Child
        </QuickContextHoverWrapper>
      );

      expect(await screen.findByText(/Text from Child/i)).toBeInTheDocument();
      expect(screen.getByTestId('quick-context-hover-trigger')).toBeInTheDocument();
    });

    it('Renders HoverCard with Issue Context', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        body: mockedGroup,
      });

      render(
        <QuickContextHoverWrapper contextType={ContextType.ISSUE} dataRow={defaultRow}>
          Text from Child
        </QuickContextHoverWrapper>
      );

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(
        await screen.findByTestId('quick-context-issue-status-container')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('quick-context-suspect-commits-container')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('quick-context-assigned-to-container')
      ).toBeInTheDocument();
    });

    it('Renders HoverCard with Release Context', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/undefined/releases/backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76/',
        body: mockedReleaseWithHealth,
      });

      render(
        <QuickContextHoverWrapper contextType={ContextType.RELEASE} dataRow={defaultRow}>
          Text from Child
        </QuickContextHoverWrapper>
      );

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(
        await screen.findByTestId('quick-context-release-details-container')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('quick-context-release-issues-and-authors-container')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('quick-context-release-last-commit-container')
      ).toBeInTheDocument();
    });
  });
});
