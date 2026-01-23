import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import LegacyPreprodRedirect from './legacyUrlRedirect';

describe('LegacyPreprodRedirect', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const project = ProjectFixture({
    id: '12345',
    slug: 'fishbox-ios',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('redirects size view with project ID instead of slug', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    const {router} = render(<LegacyPreprodRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/preprod/fishbox-ios/17532/',
        },
        route: '/organizations/:orgId/preprod/:projectId/:artifactId/',
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/preprod/size/17532/'
      );
    });
    expect(router.location.query).toEqual({project: '12345'});
  });

  it('redirects compare view with project ID', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    const {router} = render(<LegacyPreprodRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/preprod/fishbox-ios/compare/100/99/',
        },
        route:
          '/organizations/:orgId/preprod/:projectId/compare/:headArtifactId/:baseArtifactId/',
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/preprod/size/compare/100/99/'
      );
    });
    expect(router.location.query).toEqual({project: '12345'});
  });

  it('redirects install view with project ID', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    const {router} = render(<LegacyPreprodRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/preprod/fishbox-ios/install/17532/',
        },
        route: '/organizations/:orgId/preprod/:projectId/install/:artifactId/',
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/preprod/install/17532/'
      );
    });
    expect(router.location.query).toEqual({project: '12345'});
  });

  it('falls back to slug if project is not found', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    const {router} = render(<LegacyPreprodRedirect />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/preprod/unknown-project/17532/',
        },
        route: '/organizations/:orgId/preprod/:projectId/:artifactId/',
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/preprod/size/17532/'
      );
    });
    expect(router.location.query).toEqual({project: 'unknown-project'});
  });
});
