import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {type ProjectStats} from 'sentry/types/project';
import {ProjectCard} from 'sentry/views/projectsDashboard/projectCard';

function addProjectStatsResponse({
  latestDeploys,
  organization = OrganizationFixture(),
  project = ProjectFixture({platform: 'javascript'}),
  stats,
  transactionStats,
}: {
  latestDeploys?: ReturnType<typeof ProjectFixture>['latestDeploys'];
  organization?: ReturnType<typeof OrganizationFixture>;
  project?: ReturnType<typeof ProjectFixture>;
  stats?: ProjectStats;
  transactionStats?: ProjectStats;
} = {}) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/projects/`,
    body: [
      {
        ...project,
        latestDeploys,
        stats,
        transactionStats,
      },
    ],
  });
}

describe('ProjectCard', () => {
  const createWrapper = async () => {
    const project = ProjectFixture({platform: 'javascript'});
    addProjectStatsResponse({
      project,
      stats: [
        [1525042800, 1],
        [1525046400, 2],
      ],
      transactionStats: [
        [1525042800, 4],
        [1525046400, 8],
      ],
    });

    render(<ProjectCard project={project} hasProjectAccess={false} />);
    await screen.findByText('Errors: 3');
  };

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    await createWrapper();
  });

  it('renders latest 2 deploys', async () => {
    const project = ProjectFixture({
      platform: 'javascript',
    });
    const latestDeploys = {
      beta: {
        dateFinished: '2018-05-10T20:56:40.092Z',
        version: '123456',
      },
      staging: {
        dateFinished: '2018-05-08T20:56:40.092Z',
        version: '789789',
      },
      production: {
        dateFinished: '2018-05-09T20:56:40.092Z',
        version: '123123',
      },
    };

    addProjectStatsResponse({
      project,
      stats: [
        [1525042800, 1],
        [1525046400, 2],
      ],
      latestDeploys,
    });

    render(<ProjectCard project={project} hasProjectAccess={false} />);

    expect(screen.queryByRole('button', {name: 'Track Deploys'})).not.toBeInTheDocument();
    expect(await screen.findByText('beta')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.queryByText('staging')).not.toBeInTheDocument();
  });

  it('renders empty state if no deploys', async () => {
    await createWrapper();

    expect(screen.getByRole('button', {name: 'Track Deploys'})).toBeInTheDocument();
  });

  it('renders with platform', async () => {
    await createWrapper();

    expect(screen.getByTestId('platform-icon-javascript')).toBeInTheDocument();
  });

  it('renders header link for errors', async () => {
    const project = ProjectFixture({
      platform: 'javascript',
    });
    addProjectStatsResponse({
      project,
      stats: [
        [1525042800, 3],
        [1525046400, 3],
      ],
    });

    render(<ProjectCard project={project} hasProjectAccess={false} />);

    expect(await screen.findByTestId('project-errors')).toBeInTheDocument();
    expect(await screen.findByText('Errors: 6')).toBeInTheDocument();

    // No transactions as the feature isn't set.
    expect(screen.queryByTestId('project-transactions')).not.toBeInTheDocument();
  });

  it('renders header link for transactions', async () => {
    const organization = OrganizationFixture({features: ['performance-view']});
    const project = ProjectFixture({
      platform: 'javascript',
    });
    addProjectStatsResponse({
      organization,
      project,
      stats: [
        [1525042800, 3],
        [1525046400, 3],
      ],
      transactionStats: [
        [1525042800, 4],
        [1525046400, 4],
      ],
    });

    render(<ProjectCard project={project} hasProjectAccess={false} />, {organization});

    expect(await screen.findByTestId('project-errors')).toBeInTheDocument();
    expect(await screen.findByTestId('project-transactions')).toBeInTheDocument();
    expect(await screen.findByText('Transactions: 8')).toBeInTheDocument();
  });

  it('renders loading placeholder card if there are no stats', () => {
    render(<ProjectCard project={ProjectFixture()} hasProjectAccess={false} />);

    const chartContainer = screen.getByTestId('chart-container');
    expect(within(chartContainer).getByTestId('loading-placeholder')).toBeInTheDocument();
  });
});
