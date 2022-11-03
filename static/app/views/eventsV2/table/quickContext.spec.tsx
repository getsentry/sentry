import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

const queryClient = new QueryClient();

const renderQuickContextContent = (
  dataRow: EventData = defaultRow,
  contextType: ContextType = ContextType.ISSUE
) => {
  const organization = TestStubs.Organization();
  render(
    <QueryClientProvider client={queryClient}>
      <QuickContextHoverWrapper dataRow={dataRow} contextType={contextType}>
        Text from Child
      </QuickContextHoverWrapper>
    </QueryClientProvider>,
    {organization}
  );
};

describe('Quick Context', function () {
  describe('Quick Context default behaviour', function () {
    afterEach(() => {
      queryClient.clear();
      MockApiClient.clearMockResponses();
    });

    it('Loading state renders for Quick Context.', async () => {
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
});
