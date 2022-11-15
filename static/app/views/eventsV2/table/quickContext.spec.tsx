import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {Commit, Repository, User} from 'sentry/types';
import {
  EntryType,
  Event,
  EventError,
  EventOrGroupType,
  ExceptionType,
  ExceptionValue,
  Frame,
} from 'sentry/types/event';
import {EventData} from 'sentry/utils/discover/eventView';

import {ContextType, QuickContextHoverWrapper} from './quickContext';

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

const queryClient = new QueryClient();

const renderQuickContextContent = (
  dataRow: EventData = defaultRow,
  contextType: ContextType = ContextType.ISSUE
) => {
  const organization = TestStubs.Organization();
  render(
    <QueryClientProvider client={queryClient}>
      <QuickContextHoverWrapper
        dataRow={dataRow}
        contextType={contextType}
        organization={organization}
      >
        Text from Child
      </QuickContextHoverWrapper>
    </QueryClientProvider>,
    {organization}
  );
};

const makeEvent = (event: Partial<Event> = {}): Event => {
  const evt: Event = {
    ...TestStubs.Event(),
    ...event,
  };

  return evt;
};

describe('Quick Context', function () {
  describe('Quick Context default behaviour', function () {
    afterEach(() => {
      queryClient.clear();
      MockApiClient.clearMockResponses();
    });

    it('Renders child and trigger icon.', async () => {
      renderQuickContextContent();

      expect(await screen.findByText(/Text from Child/i)).toBeInTheDocument();
      expect(screen.getByTestId('quick-context-hover-trigger')).toBeInTheDocument();
    });

    it('Renders quick context hover body', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: mockedGroup,
      });
      renderQuickContextContent();

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByTestId('quick-context-hover-body')).toBeInTheDocument();
    });

    it('Renders quick context failure message', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        statusCode: 400,
      });

      renderQuickContextContent();

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      // Error is expected, do not fail when calling console.error
      jest.spyOn(console, 'error').mockImplementation();
      expect(
        await screen.findByText(/Failed to load context for column./i)
      ).toBeInTheDocument();
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
    });

    afterEach(function () {
      queryClient.clear();
      MockApiClient.clearMockResponses();
    });

    it('Renders ignored Issue status context when data is loaded', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: mockedGroup,
      });

      renderQuickContextContent();

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Ignored/i)).toBeInTheDocument();
      expect(screen.getByTestId('quick-context-ignored-icon')).toBeInTheDocument();
    });

    it('Renders resolved Issue status context when data is loaded', async () => {
      mockedGroup = {...mockedGroup, status: 'resolved'};
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: mockedGroup,
      });
      renderQuickContextContent();

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
      expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    });

    it('Renders unresolved Issue status context when data is loaded', async () => {
      mockedGroup = {...mockedGroup, status: 'unresolved'};
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: mockedGroup,
      });

      renderQuickContextContent();

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Unresolved/i)).toBeInTheDocument();
      expect(screen.getByTestId('quick-context-unresolved-icon')).toBeInTheDocument();
    });

    it('Renders assigned To context when data is loaded', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: mockedGroup,
      });
      renderQuickContextContent();

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/Assigned To/i)).toBeInTheDocument();
      expect(screen.getByText(/#ingest/i)).toBeInTheDocument();
    });

    it('Does not render suspect commit to context when row lacks event id', async () => {
      const dataRowWithoutId: unknown = {
        issue: 'SENTRY-VVY',
        release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
        title: 'error: Error -3 while decompressing data: invalid stored block lengths',
        'issue.id': 3512441874,
        'project.name': 'sentry',
      };

      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: mockedGroup,
      });

      renderQuickContextContent(dataRowWithoutId as EventData);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('quick-context-suspect-commits-container')
        ).not.toBeInTheDocument();
      });
    });

    it('Renders Suspect Commits', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        method: 'GET',
        body: mockedGroup,
      });

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
      renderQuickContextContent();

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/Suspect Commits/i)).toBeInTheDocument();
      expect(screen.getByText(/MB/i)).toBeInTheDocument();
      expect(screen.getByText(/View commit/i)).toBeInTheDocument();
      expect(screen.getByText(/by/i)).toBeInTheDocument();
      expect(screen.getByText(/You/i)).toBeInTheDocument();
    });
  });

  describe('Quick Context Content Release Column', function () {
    afterEach(() => {
      queryClient.clear();
      MockApiClient.clearMockResponses();
    });

    it('Renders Release details for active release', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76/',
        body: mockedReleaseWithHealth,
      });

      renderQuickContextContent(defaultRow, ContextType.RELEASE);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

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
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76/',
        body: {...mockedReleaseWithHealth, status: 'closed'},
      });

      renderQuickContextContent(defaultRow, ContextType.RELEASE);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/Release Details/i)).toBeInTheDocument();

      expect(screen.getByText(/Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Archived/i)).toBeInTheDocument();
      expect(screen.queryByText(/Created/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/First Event/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Last Event/i)).not.toBeInTheDocument();
    });

    it('Renders Last Commit', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76/',
        body: mockedReleaseWithHealth,
      });

      renderQuickContextContent(defaultRow, ContextType.RELEASE);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/Last Commit/i)).toBeInTheDocument();
      expect(screen.getByTestId('quick-context-commit-row')).toBeInTheDocument();
    });

    it('Renders New Issues Count', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76/',
        body: mockedReleaseWithHealth,
      });

      renderQuickContextContent(defaultRow, ContextType.RELEASE);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/New Issues/i)).toBeInTheDocument();
      expect(screen.getByText(/21/i)).toBeInTheDocument();
    });

    it('Renders Commit Count and Author when user is NOT in list of authors', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76/',
        body: mockedReleaseWithHealth,
      });

      renderQuickContextContent(defaultRow, ContextType.RELEASE);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/4/i)).toBeInTheDocument();
      expect(screen.getByText(/commits by/i)).toBeInTheDocument();
      expect(screen.getAllByText(/2/i)).toHaveLength(2);
      expect(screen.getByText(/authors/i)).toBeInTheDocument();
      expect(screen.getByText(/KN/i)).toBeInTheDocument();
      expect(screen.getByText(/VN/i)).toBeInTheDocument();
    });

    it('Renders Commit Count and Author when user is in list of authors', async () => {
      jest.spyOn(ConfigStore, 'get').mockImplementation(() => mockedUser1);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76/',
        body: mockedReleaseWithHealth,
      });

      renderQuickContextContent(defaultRow, ContextType.RELEASE);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByText(/4/i)).toBeInTheDocument();
      expect(screen.getByText(/commits by you and/i)).toBeInTheDocument();
      expect(screen.getAllByText(/1/i)).toHaveLength(2);
      expect(screen.getByText(/other/i)).toBeInTheDocument();
      expect(screen.getByText(/KN/i)).toBeInTheDocument();
      expect(screen.getByText(/VN/i)).toBeInTheDocument();
    });
  });

  describe('Quick Context Content: Event ID Column', function () {
    it('Renders NO context message for events that are not errors', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
        body: makeEvent({type: EventOrGroupType.TRANSACTION, entries: []}),
      });

      renderQuickContextContent(defaultRow, ContextType.EVENT);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(
        await screen.findByText(/There is no context available./i)
      ).toBeInTheDocument();
    });

    it('Renders NO stack trace message for error events without stackTraces', async () => {
      jest.spyOn(ConfigStore, 'get').mockImplementation(() => null);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
        body: makeEvent({type: EventOrGroupType.ERROR, entries: []}),
      });

      renderQuickContextContent(defaultRow, ContextType.EVENT);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(
        await screen.findByText(/There is no stack trace available for this event./i)
      ).toBeInTheDocument();
    });

    it('Renders stack trace as context', async () => {
      const frame: Frame = {
        colNo: 0,
        filename: 'file.js',
        function: 'throwError',
        lineNo: 0,
        absPath: null,
        context: [],
        errors: null,
        inApp: false,
        instructionAddr: null,
        module: null,
        package: null,
        platform: null,
        rawFunction: null,
        symbol: null,
        symbolAddr: null,
        trust: undefined,
        vars: null,
      };

      const thread: ExceptionValue = {
        stacktrace: {
          hasSystemFrames: false,
          registers: {},
          framesOmitted: 0,
          frames: [frame],
        },
        mechanism: null,
        module: null,
        rawStacktrace: null,
        threadId: null,
        type: '',
        value: '',
      };

      const exceptionValue: ExceptionType = {
        values: [thread],
        excOmitted: undefined,
        hasSystemFrames: false,
      };

      const errorEvent: Event = {
        id: '6b43e285de834ec5b5fe30d62d549b20',
        type: EventOrGroupType.ERROR,
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: exceptionValue,
          },
        ],
      } as EventError;

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
        body: makeEvent(errorEvent),
      });

      renderQuickContextContent(defaultRow, ContextType.EVENT);

      userEvent.hover(screen.getByTestId('quick-context-hover-trigger'));

      expect(await screen.findByTestId('stack-trace-content')).toBeInTheDocument();
    });
  });
});
