import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import UserFeedback from 'sentry/views/userFeedback';

describe('UserFeedback', function () {
  const {organization, router, routerContext} = initializeOrg();
  const pageLinks =
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  const project = TestStubs.Project({isMember: true});

  beforeEach(function () {
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [TestStubs.UserFeedback()],
      headers: {Link: pageLinks},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: TestStubs.Environments(),
    });
  });

  afterEach(function () {
    ProjectsStore.reset();
  });

  it('renders', async function () {
    const params = {
      organization: TestStubs.Organization(),
      location: {query: {}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
      headers: {Link: pageLinks},
    });

    render(<UserFeedback {...params} />, {context: routerContext});

    expect(screen.getByText('Something bad happened')).toBeInTheDocument();
  });

  it('renders no project message', async function () {
    ProjectsStore.loadInitialData([]);

    const params = {
      organization: TestStubs.Organization(),
      location: {query: {}, search: ''},
      params: {
        orgId: organization.slug,
      },
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
      organization: TestStubs.Organization({
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: {query: {}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    expect(screen.getByTestId('user-feedback-empty')).toBeInTheDocument();
  });

  it('renders empty state with project query', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [],
    });

    const params = {
      organization: TestStubs.Organization({
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: {pathname: 'sentry', query: {project: '112'}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    expect(screen.getByTestId('user-feedback-empty')).toBeInTheDocument();
  });

  it('renders issue status filter', async function () {
    const params = {
      organization: TestStubs.Organization({
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: router.location,
      params: {
        orgId: organization.slug,
      },
      router,
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
      organization: TestStubs.Organization({
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: {pathname: 'sentry', query: {project: ['112', '113']}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    render(<UserFeedback {...params} />, {context: routerContext});

    expect(screen.getByTestId('user-feedback-empty')).toBeInTheDocument();
  });
});
