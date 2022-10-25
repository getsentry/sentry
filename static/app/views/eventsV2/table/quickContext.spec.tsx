import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';

import QuickContext from './quickContext';
import {TableColumn} from './types';

const defaultRow: TableDataRow = {
  id: '6b43e285de834ec5b5fe30d62d549b20',
  issue: 'SENTRY-VVY',
  release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
  title: 'error: Error -3 while decompressing data: invalid stored block lengths',
  'issue.id': 3512441874,
  'project.name': 'sentry',
};

const defaultColumn: TableColumn<keyof TableDataRow> = {
  column: {
    alias: undefined,
    field: 'issue',
    kind: 'field',
  },
  isSortable: false,
  key: 'issue',
  name: 'issue',
  type: 'string',
  width: -1,
};

const renderComponent = (
  dataRow: TableDataRow = defaultRow,
  column: TableColumn<keyof TableDataRow> = defaultColumn
) => {
  const organization = TestStubs.Organization();
  render(<QuickContext dataRow={dataRow} column={column} />, {organization});
};

describe('Quick Context Container', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('Quick Context default behaviour', function () {
    it('Loading/Error states render for Quick Context.', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        statusCode: 500,
      });
      renderComponent();

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(
        await screen.findByText(/Failed to load context for column./i)
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('quick-context-loading-indicator')
      ).not.toBeInTheDocument();
    });
  });

  describe('Quick Context for Issue Column', function () {
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

    afterEach(() => {
      GroupStore.reset();
    });

    describe('Quick Context for Issue Column - Status', function () {
      it('Render Ignored Issue status context when data is loaded', async () => {
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: mockedGroup,
        });
        renderComponent();

        expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Ignored/i)).toBeInTheDocument();
        expect(screen.getByTestId('quick-context-ignored-icon')).toBeInTheDocument();
        expect(
          screen.queryByTestId('quick-context-loading-indicator')
        ).not.toBeInTheDocument();
      });

      it('Render Resolved Issue status context when data is loaded', async () => {
        mockedGroup = {...mockedGroup, status: 'resolved'};
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: mockedGroup,
        });
        renderComponent();

        expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
        expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
        expect(
          screen.queryByTestId('quick-context-loading-indicator')
        ).not.toBeInTheDocument();
      });

      it('Render Unresolved Issue status context when data is loaded', async () => {
        mockedGroup = {...mockedGroup, status: 'unresolved'};
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: mockedGroup,
        });
        renderComponent();

        expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Unresolved/i)).toBeInTheDocument();
        expect(screen.getByTestId('quick-context-unresolved-icon')).toBeInTheDocument();
        expect(
          screen.queryByTestId('quick-context-loading-indicator')
        ).not.toBeInTheDocument();
      });
    });

    describe('Quick Context for Issue Column - Assignee', function () {
      it('Render Assigned To context when data is loaded', async () => {
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: mockedGroup,
        });
        renderComponent();

        expect(await screen.findByText(/Assigned To/i)).toBeInTheDocument();
        expect(screen.getByText(/#ingest/i)).toBeInTheDocument();
        expect(
          screen.queryByTestId('quick-context-loading-indicator')
        ).not.toBeInTheDocument();
      });
    });

    describe('Quick Context for Issue Column - Suspect Commits', function () {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: mockedGroup,
        });
      });

      it('Does not render suspect commit to context when row lacks event id', async () => {
        const dataRowWithoutId: unknown = {
          issue: 'SENTRY-VVY',
          release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
          title: 'error: Error -3 while decompressing data: invalid stored block lengths',
          'issue.id': 3512441874,
          'project.name': 'sentry',
        };

        renderComponent(dataRowWithoutId as TableDataRow);

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
        renderComponent();

        expect(await screen.findByText(/Suspect Commits/i)).toBeInTheDocument();
        expect(screen.getByText(/MB/i)).toBeInTheDocument();
        expect(screen.getByText(/View commit/i)).toBeInTheDocument();
        expect(screen.getByText(/by/i)).toBeInTheDocument();
        expect(screen.getByText(/You/i)).toBeInTheDocument();
      });
    });
  });
});
