import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectCard} from 'sentry/views/projectsDashboard/projectCard';

// NOTE: Unmocking debounce so that the actionCreator never fires
jest.unmock('lodash/debounce');

describe('ProjectCard', function () {
  const createWrapper = () =>
    render(
      <ProjectCard
        organization={OrganizationFixture()}
        project={ProjectFixture({
          stats: [
            [1525042800, 1],
            [1525046400, 2],
          ],
          transactionStats: [
            [1525042800, 4],
            [1525046400, 8],
          ],
          platform: 'javascript',
        })}
        hasProjectAccess={false}
        api={new MockApiClient()}
      />
    );

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    createWrapper();
  });

  it('renders latest 2 deploys', function () {
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

    render(
      <ProjectCard
        organization={OrganizationFixture()}
        project={ProjectFixture({
          stats: [
            [1525042800, 1],
            [1525046400, 2],
          ],
          platform: 'javascript',
          latestDeploys,
        })}
        hasProjectAccess={false}
        api={new MockApiClient()}
      />
    );

    expect(screen.queryByRole('button', {name: 'Track Deploys'})).not.toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.queryByText('staging')).not.toBeInTheDocument();
  });

  it('renders empty state if no deploys', function () {
    createWrapper();

    expect(screen.getByRole('button', {name: 'Track Deploys'})).toBeInTheDocument();
  });

  it('renders with platform', function () {
    createWrapper();

    // @TODO(jonasbadalic): is testing for image and the platform icon both required?
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByTestId('platform-icon-javascript')).toBeInTheDocument();
  });

  it('renders header link for errors', function () {
    render(
      <ProjectCard
        organization={OrganizationFixture()}
        project={ProjectFixture({
          stats: [
            [1525042800, 3],
            [1525046400, 3],
          ],
          platform: 'javascript',
        })}
        hasProjectAccess={false}
        api={new MockApiClient()}
      />
    );

    expect(screen.getByTestId('project-errors')).toBeInTheDocument();
    expect(screen.getByText('Errors: 6')).toBeInTheDocument();

    // No transacions as the feature isn't set.
    expect(screen.queryByTestId('project-transactions')).not.toBeInTheDocument();
  });

  it('renders header link for transactions', function () {
    render(
      <ProjectCard
        organization={OrganizationFixture({features: ['performance-view']})}
        project={ProjectFixture({
          stats: [
            [1525042800, 3],
            [1525046400, 3],
          ],
          transactionStats: [
            [1525042800, 4],
            [1525046400, 4],
          ],
          platform: 'javascript',
        })}
        hasProjectAccess={false}
        api={new MockApiClient()}
      />
    );

    expect(screen.getByTestId('project-errors')).toBeInTheDocument();
    expect(screen.getByTestId('project-transactions')).toBeInTheDocument();
    expect(screen.getByText('Transactions: 8')).toBeInTheDocument();
  });

  it('renders loading placeholder card if there are no stats', function () {
    render(
      <ProjectCard
        organization={OrganizationFixture()}
        project={ProjectFixture()}
        hasProjectAccess={false}
        api={new MockApiClient()}
      />
    );

    const chartContainer = screen.getByTestId('chart-container');
    expect(within(chartContainer).getByTestId('loading-placeholder')).toBeInTheDocument();
  });
});
