import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Repository} from 'sentry-fixture/repository';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupStatus} from 'sentry/types';
import {EventData} from 'sentry/utils/discover/eventView';
import {QueryClientProvider} from 'sentry/utils/queryClient';

import IssueContext from './issueContext';
import {defaultRow} from './testUtils';

const mockedGroup = GroupFixture({
  id: '3512441874',
  project: ProjectFixture({
    id: '1',
    slug: 'cool-team',
  }),
  status: GroupStatus.IGNORED,
  assignedTo: {
    id: '12312',
    name: 'ingest',
    type: 'team',
  },
  count: '2500000',
  userCount: 64000,
  title: 'typeError: error description',
});

const renderIssueContext = (dataRow: EventData = defaultRow) => {
  const organization = Organization();
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
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
    MockApiClient.clearMockResponses();
  });

  it('Renders ignored issue status context', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Ignored/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-context-ignored-icon')).toBeInTheDocument();
  });

  it('Renders resolved issue status context', async () => {
    const group = {...mockedGroup, status: GroupStatus.RESOLVED};
    MockApiClient.addMockResponse({
      url: '/issues/3512441874/',
      method: 'GET',
      body: group,
    });
    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('Renders unresolved issue status context', async () => {
    const group = {...mockedGroup, status: GroupStatus.UNRESOLVED};
    MockApiClient.addMockResponse({
      url: '/issues/3512441874/',
      method: 'GET',
      body: group,
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

  describe('Suspect commits', () => {
    const maiseyCommitter = {
      author: {name: 'Maisey the Dog', id: '1231'},
      commits: [
        {
          message: 'feat(simulator): Add option for multiple squirrels (#1121)',
          id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
          dateCreated: '2012-09-08T04:15:12',
          repository: Repository(),
        },
      ],
    };
    const charlieCommitter = {
      author: {name: 'Charlie Bear', id: '1121'},
      commits: [
        {
          message:
            'ref(simulator): Split leaderboard calculations into separate functions (#1231)',
          id: 'fe29668b24cea6faad8afb8f6d9417f402ef9c18',
          dateCreated: '2012-04-15T09:09:12',
          repository: Repository(),
        },
      ],
    };

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/events/oldest/',
        method: 'GET',
        body: {
          eventID: '6b43e285de834ec5b5fe30d62d549b20',
        },
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('Renders a single suspect commit', async () => {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
        body: {
          committers: [maiseyCommitter],
        },
      });
      renderIssueContext();

      // Make sure the title renders in the singular, since there's only one commit
      expect(await screen.findByText(/Suspect Commit/i)).toBeInTheDocument();
      expect(screen.queryByText(/Suspect Commits/i)).not.toBeInTheDocument();

      // Ensure all commit data is present
      expect(screen.getByText(/MD/i)).toBeInTheDocument();
      expect(screen.getByTestId('quick-context-commit-row')).toHaveTextContent(
        /View commit ab27092 by Maisey the Dog/
      );
    });

    it('Renders multiple suspect commits', async () => {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/projects/org-slug/cool-team/events/6b43e285de834ec5b5fe30d62d549b20/committers/',
        body: {
          committers: [maiseyCommitter, charlieCommitter],
        },
      });
      renderIssueContext();

      // Make sure the title renders in the plural
      expect(await screen.findByText(/Suspect Commits \(2\)/i)).toBeInTheDocument();

      // When there's more than one commit, any past the first start out hidden
      const expandButton = await screen.findByTestId('expand-commit-list');
      await userEvent.click(expandButton);

      // Check that they're both there
      expect(screen.getByText(/MD/i)).toBeInTheDocument();
      expect(screen.getByText(/CB/i)).toBeInTheDocument();
      expect(screen.getAllByTestId('quick-context-commit-row')[0]).toHaveTextContent(
        /View commit ab27092 by Maisey the Dog/
      );
      expect(screen.getAllByTestId('quick-context-commit-row')[1]).toHaveTextContent(
        /View commit fe29668 by Charlie Bear/
      );
    });
  });
});
