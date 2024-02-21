import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFeedbackFixture} from 'sentry-fixture/userFeedback';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import UserFeedback from 'sentry/views/userFeedback';

describe('UserFeedback', function () {
  const {organization, router, routerContext} = initializeOrg();
  const pageLinks =
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  const project = ProjectFixture({isMember: true});

  const routeProps = {
    routes: router.routes,
    route: {},
    router,
    location: router.location,
    routeParams: router.params,
  };

  beforeEach(function () {
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [UserFeedbackFixture()],
      headers: {Link: pageLinks},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: EnvironmentsFixture(),
    });
  });

  afterEach(function () {
    ProjectsStore.reset();
  });

  it('renders', async function () {
    const params = {
      organization: OrganizationFixture(),
      params: {
        orgId: organization.slug,
      },
      ...routeProps,
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
      headers: {Link: pageLinks},
    });

    render(<UserFeedback {...params} />, {context: routerContext});

    expect(await screen.findByText('Something bad happened')).toBeInTheDocument();
  });

  it('renders no project message', function () {
    ProjectsStore.loadInitialData([]);

    const params = {
      organization: OrganizationFixture(),
      params: {
        orgId: organization.slug,
      },
      ...routeProps,
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    expect(
      screen.getByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });

  it('renders empty state', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [],
    });

    const params = {
      organization: OrganizationFixture({
        projects: [ProjectFixture({isMember: true})],
      }),
      params: {
        orgId: organization.slug,
      },
      ...routeProps,
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    expect(await screen.findByTestId('user-feedback-empty')).toBeInTheDocument();
  });

  it('renders empty state with project query', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [],
    });

    const params = {
      ...routeProps,
      organization: OrganizationFixture({
        projects: [ProjectFixture({isMember: true})],
      }),
      location: {
        ...routeProps.location,
        pathname: 'sentry',
        query: {project: '112'},
        search: '',
      },
      params: {
        orgId: organization.slug,
      },
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    expect(await screen.findByTestId('user-feedback-empty')).toBeInTheDocument();
  });

  it('renders issue status filter', async function () {
    const params = {
      organization: OrganizationFixture({
        projects: [ProjectFixture({isMember: true})],
      }),
      params: {
        orgId: organization.slug,
      },
      ...routeProps,
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    // "Unresolved"  is selected by default
    const unresolved = screen.getByRole('radio', {name: 'Unresolved'});
    expect(unresolved).toBeInTheDocument();
    expect(unresolved).toBeChecked();

    // Select "All Issues"
    const all = screen.getByRole('radio', {name: 'All Issues'});
    expect(all).toBeInTheDocument();
    expect(all).not.toBeChecked();
    await userEvent.click(all);

    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({query: {status: ''}})
    );
  });

  it('renders empty state with multi project query', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [],
    });

    const params = {
      ...routeProps,
      organization: OrganizationFixture({
        projects: [ProjectFixture({isMember: true})],
      }),
      location: {
        ...routeProps.location,
        pathname: 'sentry',
        query: {project: ['112', '113']},
        search: '',
      },
      params: {
        orgId: organization.slug,
      },
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    expect(await screen.findByTestId('user-feedback-empty')).toBeInTheDocument();
  });
});
