import {QueryClientProvider} from '@tanstack/react-query';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventData} from 'sentry/utils/discover/eventView';
import {QueryClient} from 'sentry/utils/queryClient';

import IssueContext from './issueContext';
import {defaultRow} from './testUtils';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

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
  count: 2500000,
  userCount: 64000,
  title: 'typeError: error description',
});

const renderIssueContext = (dataRow: EventData = defaultRow) => {
  const organization = TestStubs.Organization();
  render(
    <QueryClientProvider client={queryClient}>
      <IssueContext dataRow={dataRow} organization={organization} />
    </QueryClientProvider>,
    {organization}
  );
};

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

    MockApiClient.addMockResponse({
      url: '/issues/3512441874/events/oldest/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/issues/3512441874/',
      method: 'GET',
      body: mockedGroup,
    });
  });

  afterEach(function () {
    queryClient.clear();
    MockApiClient.clearMockResponses();
  });

  it('Renders ignored issue status context', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Ignored/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-context-ignored-icon')).toBeInTheDocument();
  });

  it('Renders resolved issue status context', async () => {
    mockedGroup = {...mockedGroup, status: 'resolved'};
    MockApiClient.addMockResponse({
      url: '/issues/3512441874/',
      method: 'GET',
      body: mockedGroup,
    });
    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('Renders unresolved issue status context', async () => {
    mockedGroup = {...mockedGroup, status: 'unresolved'};
    MockApiClient.addMockResponse({
      url: '/issues/3512441874/',
      method: 'GET',
      body: mockedGroup,
    });

    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Unresolved/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-context-unresolved-icon')).toBeInTheDocument();
  });

  it('Renders event and user counts', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Events/i)).toBeInTheDocument();
    expect(screen.getByText(/2.5m/i)).toBeInTheDocument();
    expect(screen.getByText(/Users/i)).toBeInTheDocument();
    expect(screen.getByText(/64k/i)).toBeInTheDocument();
  });

  it('Renders assigned to context', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Assigned To/i)).toBeInTheDocument();
    expect(screen.getByText(/#ingest/i)).toBeInTheDocument();
  });

  it('Renders title', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Title/i)).toBeInTheDocument();
    expect(screen.getByText(/typeError: error description/i)).toBeInTheDocument();
  });

  it('Renders Suspect Commits', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/3512441874/events/oldest/',
      method: 'GET',
      body: {
        eventID: '6b43e285de834ec5b5fe30d62d549b20',
      },
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
    renderIssueContext();

    expect(await screen.findByText(/Suspect Commits/i)).toBeInTheDocument();
    expect(screen.getByText(/MB/i)).toBeInTheDocument();
    expect(screen.getByText(/View commit/i)).toBeInTheDocument();
    expect(screen.getByText(/by/i)).toBeInTheDocument();
    expect(screen.getByText(/You/i)).toBeInTheDocument();
  });
});
