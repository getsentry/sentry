import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {redirectDeprecatedProjectRoute} from 'sentry/views/projects/redirectDeprecatedProjectRoute';

jest.mock('sentry/utils/analytics');

describe('redirectDeprecatedProjectRoute', () => {
  const organization = OrganizationFixture({slug: 'old-org'});
  const project = ProjectFixture({
    id: '123',
    slug: 'old-project',
    organization: {id: '456', slug: organization.slug},
  });
  const pathname = `/${organization.slug}/${project.slug}/`;
  const initialRouterConfig = {
    location: {pathname},
    route: '/:orgId/:projectId/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('redirects legacy project routes to the generated route', async () => {
    const projectRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
      match: [MockApiClient.matchQuery({collapse: 'organization'})],
    });
    const RedirectDeprecatedProjectRoute = redirectDeprecatedProjectRoute(
      ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
    );

    const {router} = render(<RedirectDeprecatedProjectRoute />, {
      initialRouterConfig,
    });

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {project: project.id},
        })
      );
    });

    expect(projectRequest).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith('deprecated_urls.redirect', {
      feature: 'global_views',
      url: pathname,
      organization: project.organization.id,
    });
  });

  it('displays a project not found error on 404s', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      statusCode: 404,
    });
    const RedirectDeprecatedProjectRoute = redirectDeprecatedProjectRoute(
      ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
    );

    render(<RedirectDeprecatedProjectRoute />, {
      initialRouterConfig,
    });

    expect(
      await screen.findByText('The project you were looking for was not found.')
    ).toBeInTheDocument();
  });
});
