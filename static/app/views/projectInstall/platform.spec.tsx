import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

type ProjectWithBadPlatform = Omit<Project, 'platform'> & {
  platform: string;
};

function mockProjectApiResponses(projects: Array<Project | ProjectWithBadPlatform>) {
  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/organizations/org-slug/projects/',
    body: projects,
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/docs/other/',
    body: {},
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/rules/',
    body: [],
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/',
    body: projects,
  });

  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/keys/',
    method: 'GET',
    body: [ProjectKeysFixture()[0]],
  });

  MockApiClient.addMockResponse({
    url: `/projects/org-slug/project-slug/keys/${ProjectKeysFixture()[0].public}/`,
    method: 'PUT',
    body: {},
  });
}

describe('ProjectInstallPlatform', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ConfigStore.init();
  });

  it('should render NotFound if no matching integration/platform', async function () {
    const routeParams = {
      projectId: ProjectFixture().slug,
    };
    const {organization, routerProps, project, router} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: routeParams,
      },
    });

    mockProjectApiResponses([{...project, platform: 'lua'}]);

    render(<ProjectInstallPlatform {...routerProps} />, {
      organization,
      router,
    });

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
  });

  it('should display info for a non-supported platform', async function () {
    const routeParams = {
      projectId: ProjectFixture().slug,
    };

    const {organization, routerProps, project} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: routeParams,
      },
    });

    // this is needed because we don't handle a loading state in the UI
    ProjectsStore.loadInitialData([{...project, platform: 'other'}]);

    mockProjectApiResponses([{...project, platform: 'other'}]);

    render(<ProjectInstallPlatform {...routerProps} />, {
      organization,
    });

    expect(
      await screen.findByText(/We cannot provide instructions for 'Other' projects/)
    ).toBeInTheDocument();
  });

  it('should render getting started docs for correct platform', async function () {
    const project = ProjectFixture({platform: 'javascript'});

    const routeParams = {
      projectId: project.slug,
      platform: 'python',
    };

    const {routerProps, router} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: routeParams,
      },
    });

    ProjectsStore.loadInitialData([project]);

    mockProjectApiResponses([project]);

    render(<ProjectInstallPlatform {...routerProps} />, {
      router,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Configure Browser JavaScript SDK',
      })
    ).toBeInTheDocument();

    expect(await screen.getByText('Take me to Issues')).toBeInTheDocument();
    expect(await screen.getByText('Take me to Performance')).toBeInTheDocument();
    expect(await screen.getByText('Take me to Session Replay')).toBeInTheDocument();
  });

  it('should not render performance/session replay buttons for errors only self-hosted', async function () {
    const project = ProjectFixture({platform: 'javascript'});

    const routeParams = {
      projectId: project.slug,
      platform: 'python',
    };

    const {routerProps, router} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: routeParams,
      },
    });

    ProjectsStore.loadInitialData([project]);

    mockProjectApiResponses([project]);
    ConfigStore.set('isSelfHostedErrorsOnly', true);

    render(<ProjectInstallPlatform {...routerProps} />, {
      router,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Configure Browser JavaScript SDK',
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Take me to Issues')).toBeInTheDocument();
    expect(() => screen.getByText('Take me to Performance')).toThrow();
    expect(() => screen.getByText('Take me to Session Replay')).toThrow();
  });
});
