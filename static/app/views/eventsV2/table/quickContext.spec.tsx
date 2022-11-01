import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import {Group} from 'sentry/types';
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

const renderQuickContextContent = (
  data: Group | null = null,
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
  });
});
