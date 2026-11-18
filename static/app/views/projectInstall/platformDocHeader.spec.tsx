import {Outlet} from 'react-router';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useRecentCreatedProjectHook from 'sentry/components/onboarding/useRecentCreatedProject';
import type {PlatformIntegration} from 'sentry/types/project';

import {FROM_PROJECT_CREATION_STATE} from './gettingStartedLocationState';
import {PlatformDocHeader} from './platformDocHeader';

const platform: PlatformIntegration = {
  id: 'python',
  name: 'Python',
  link: 'https://docs.sentry.io/platforms/python/',
  type: 'language',
  language: 'python',
};

const GETTING_STARTED_PATH = '/organizations/org-slug/projects/python/getting-started/';

function renderGettingStartedAfter(previousPath: string) {
  const organization = OrganizationFixture();
  const project = ProjectFixture({slug: 'python', platform: 'python', firstEvent: null});
  jest.spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject').mockReturnValue({
    project,
    isProjectActive: false,
  });
  const deleteRequest = MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/`,
    method: 'DELETE',
    body: {},
  });

  const {router} = render(<Outlet />, {
    organization,
    initialRouterConfig: {
      routes: [
        '/organizations/:orgId/projects/',
        '/organizations/:orgId/insights/projects/',
      ],
      location: {pathname: previousPath},
      children: [
        {path: 'new/', element: <div>Create project</div>},
        {path: ':projectId/', element: <div>Project details</div>},
        {
          path: ':projectId/getting-started/',
          element: <PlatformDocHeader platform={platform} projectSlug={project.slug} />,
        },
      ],
    },
  });

  return {deleteRequest, project, router};
}

describe('PlatformDocHeader', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('deletes an inactive project on browser back from project creation', async () => {
    const {deleteRequest, project, router} = renderGettingStartedAfter(
      '/organizations/org-slug/projects/new/'
    );
    router.navigate(GETTING_STARTED_PATH, {state: FROM_PROJECT_CREATION_STATE});
    await screen.findByRole('heading', {name: 'Configure Python SDK'});

    router.navigate(-1);

    await waitFor(() => expect(deleteRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(router.location.query).toEqual({
        referrer: 'getting-started',
        project: project.id,
      })
    );
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/insights/projects/new/'
    );
  });

  it('keeps normal browser back when not reached from project creation', async () => {
    const {deleteRequest, router} = renderGettingStartedAfter(
      '/organizations/org-slug/projects/python/'
    );
    router.navigate(GETTING_STARTED_PATH);
    await screen.findByRole('heading', {name: 'Configure Python SDK'});

    router.navigate(-1);

    expect(await screen.findByText('Project details')).toBeInTheDocument();
    expect(router.location.pathname).toBe('/organizations/org-slug/projects/python/');
    expect(deleteRequest).not.toHaveBeenCalled();
  });
});
