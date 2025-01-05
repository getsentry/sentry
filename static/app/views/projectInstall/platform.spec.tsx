import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PlatformIntegration, PlatformKey, Project} from 'sentry/types/project';
import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

type ProjectWithBadPlatform = Omit<Project, 'platform'> & {
  platform: string;
};

function mockProjectApiResponses(projects: (Project | ProjectWithBadPlatform)[]) {
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
    url: `/projects/org-slug/project-slug/keys/${ProjectKeysFixture()[0]!.public}/`,
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
    const {organization, routerProps, project, router} = initializeOrg({
      router: {
        params: {
          projectId: ProjectFixture().slug,
        },
      },
    });

    mockProjectApiResponses([{...project, platform: 'lua'}]);

    render(
      <ProjectInstallPlatform
        {...routerProps}
        loading={false}
        platform={undefined}
        currentPlatformKey={'lua' as PlatformKey}
        project={project}
      />,
      {
        organization,
        router,
      }
    );

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
  });

  it('should display info for a non-supported platform', async function () {
    const {organization, routerProps, project} = initializeOrg({
      router: {
        params: {
          projectId: ProjectFixture().slug,
        },
      },
    });

    const platform: PlatformIntegration = {
      id: 'other',
      name: 'Other',
      link: 'https://docs.sentry.io/platforms/',
      type: 'language',
      language: 'other',
    };

    // this is needed because we don't handle a loading state in the UI
    ProjectsStore.loadInitialData([{...project, platform: platform.id}]);

    mockProjectApiResponses([{...project, platform: platform.id}]);

    render(
      <ProjectInstallPlatform
        {...routerProps}
        loading={false}
        platform={platform}
        project={project}
        currentPlatformKey={platform.id}
      />,
      {
        organization,
      }
    );

    expect(
      await screen.findByText(/We cannot provide instructions for 'Other' projects/)
    ).toBeInTheDocument();
  });

  it('should not render performance/session replay buttons for errors only self-hosted', async function () {
    const project = ProjectFixture({platform: 'javascript'});

    const {routerProps, router} = initializeOrg({
      router: {
        params: {
          projectId: project.slug,
        },
      },
    });

    ProjectsStore.loadInitialData([project]);

    mockProjectApiResponses([project]);
    ConfigStore.set('isSelfHostedErrorsOnly', true);

    const platform: PlatformIntegration = {
      id: 'javascript',
      name: 'Browser JavaScript',
      type: 'language',
      language: 'javascript',
      link: 'https://docs.sentry.io/platforms/javascript/',
    };

    render(
      <ProjectInstallPlatform
        {...routerProps}
        project={project}
        loading={false}
        platform={platform}
        currentPlatformKey={platform.id}
      />,
      {
        router,
      }
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Configure Browser JavaScript SDK',
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Take me to Issues')).toBeInTheDocument();
  });
});
