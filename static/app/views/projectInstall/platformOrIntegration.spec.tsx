import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';

import PlatformOrIntegration from './platformOrIntegration';

type ProjectWithBadPlatform = Omit<Project, 'platform'> & {
  platform: string;
};

function mockProjectApiResponses(projects: Array<Project | ProjectWithBadPlatform>) {
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
    method: 'GET',
    url: '/projects/org-slug/project-slug/overview/',
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
  it('should render getting started docs for correct platform', async function () {
    const project = ProjectFixture({platform: 'javascript'});

    const {routerProps, router} = initializeOrg({
      router: {
        params: {
          projectId: project.slug,
          platform: 'python',
        },
      },
    });

    ProjectsStore.loadInitialData([project]);

    mockProjectApiResponses([project]);

    render(<PlatformOrIntegration {...routerProps} />, {
      router,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Configure Browser JavaScript SDK',
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Take me to Issues')).toBeInTheDocument();
  });
});
