import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ReleasesDetailContainer from 'sentry/views/explore/releases/detail';

describe('ReleasesDetailContainer', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/1.0.0/meta/',
      statusCode: 404,
      body: {},
    });
  });

  it('removes global date params from the URL without a history entry when they are present', async () => {
    const onNuqsUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();

    const {router} = render(<ReleasesDetailContainer />, {
      organization,
      onNuqsUrlUpdate,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/releases/1.0.0/',
          query: {
            project: '1',
            statsPeriod: '14d',
            utc: 'true',
            pageStatsPeriod: '7d',
          },
        },
        route: '/organizations/:orgId/releases/:release/',
      },
    });

    await waitFor(() =>
      expect(router.location.query).toEqual({project: '1', pageStatsPeriod: '7d'})
    );
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'replace'})})
    );
  });
});
