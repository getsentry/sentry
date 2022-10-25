import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import UserFeedback from 'sentry/views/userFeedback';

describe('UserFeedback', function () {
  const {organization, routerContext} = initializeOrg();
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

  it('renders', function () {
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

  it('renders no project message', function () {
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

  it('renders empty state', function () {
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

  it('renders empty state with project query', function () {
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

    expect(screen.getByRole('button', {name: 'All Issues'})).toHaveAttribute(
      'href',
      'sentry?project=112&status='
    );
  });

  it('renders empty state with multi project query', function () {
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

    expect(screen.getByRole('button', {name: 'All Issues'})).toHaveAttribute(
      'href',
      'sentry?project=112&project=113&status='
    );
  });
});
