import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import LatestBaseSnapshotResolver from './latestBaseSnapshotResolver';

describe('LatestBaseSnapshotResolver', () => {
  const organization = OrganizationFixture();

  const LATEST_BASE_URL =
    '/organizations/org-slug/preprodartifacts/snapshots/latest-base/';

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/preprod/snapshots/latest-base/my-project/com.acme.app/`,
    },
    route: '/organizations/:orgId/preprod/snapshots/latest-base/:projectId/:appId/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('redirects to the snapshot viewer for the resolved head artifact', async () => {
    const latestBaseMock = MockApiClient.addMockResponse({
      url: LATEST_BASE_URL,
      method: 'GET',
      body: {head_artifact_id: 'abc123'},
      match: [MockApiClient.matchQuery({app_id: 'com.acme.app', project: 'my-project'})],
    });

    const {router} = render(<LatestBaseSnapshotResolver />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/preprod/snapshots/abc123/'
      );
    });
    expect(latestBaseMock).toHaveBeenCalled();
  });

  it('shows an error when no base snapshot is found', async () => {
    MockApiClient.addMockResponse({
      url: LATEST_BASE_URL,
      method: 'GET',
      statusCode: 404,
      body: {detail: 'No snapshot found'},
    });

    const {router} = render(<LatestBaseSnapshotResolver />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByText('No base snapshot found')).toBeInTheDocument();
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/preprod/snapshots/latest-base/my-project/com.acme.app/'
    );
  });
});
