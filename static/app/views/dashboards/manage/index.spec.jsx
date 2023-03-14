import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';

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
  const mockUnauthorizedOrg = TestStubs.Organization({
    features: ['global-views', 'dashboards-basic', 'discover-query'],
  });

  const mockAuthorizedOrg = TestStubs.Organization({
    features: FEATURES,
  });
  beforeEach(function () {
    act(() => ProjectsStore.loadInitialData([TestStubs.Project()]));

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
        organization={mockUnauthorizedOrg}
        location={{query: {}}}
        router={{}}
      />
    );

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('denies access on no projects', function () {
    act(() => ProjectsStore.loadInitialData([]));

    render(
      <ManageDashboards
        organization={mockAuthorizedOrg}
        location={{query: {}}}
        router={{}}
      />
    );

    expect(
      screen.getByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });

  it('creates new dashboard', async function () {
    const org = TestStubs.Organization({features: FEATURES});

    render(<ManageDashboards organization={org} location={{query: {}}} router={{}} />);

    await userEvent.click(screen.getByTestId('dashboard-create'));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/dashboards/new/',
      query: {},
    });
  });

  it('can sort', async function () {
    const org = TestStubs.Organization({features: FEATURES});

    render(<ManageDashboards organization={org} location={{query: {}}} router={{}} />);

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
