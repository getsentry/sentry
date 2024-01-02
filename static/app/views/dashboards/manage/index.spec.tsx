import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import ManageDashboards from 'sentry/views/dashboards/manage';

const FEATURES = [
  'global-views',
  'dashboards-basic',
  'dashboards-edit',
  'discover-query',
];

describe('Dashboards > Detail', function () {
  const mockUnauthorizedOrg = Organization({
    features: ['global-views', 'dashboards-basic', 'discover-query'],
  });

  const mockAuthorizedOrg = Organization({
    features: FEATURES,
  });
  beforeEach(function () {
    act(() => ProjectsStore.loadInitialData([ProjectFixture()]));

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/?sort=name&per_page=9',
      body: [],
    });
  });
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('denies access on missing feature', function () {
    render(
      <ManageDashboards
        {...RouteComponentPropsFixture()}
        organization={mockUnauthorizedOrg}
      />
    );

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('denies access on no projects', function () {
    act(() => ProjectsStore.loadInitialData([]));

    render(
      <ManageDashboards
        {...RouteComponentPropsFixture()}
        organization={mockAuthorizedOrg}
      />
    );

    expect(
      screen.getByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });

  it('creates new dashboard', async function () {
    const org = Organization({features: FEATURES});

    render(<ManageDashboards {...RouteComponentPropsFixture()} organization={org} />);

    await userEvent.click(screen.getByTestId('dashboard-create'));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/dashboards/new/',
      query: {},
    });
  });

  it('can sort', async function () {
    const org = Organization({features: FEATURES});

    render(<ManageDashboards {...RouteComponentPropsFixture()} organization={org} />);

    await selectEvent.select(
      screen.getByRole('button', {name: /sort by/i}),
      'Dashboard Name (A-Z)'
    );

    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledWith(
        expect.objectContaining({query: {sort: 'title'}})
      );
    });
  });
});
