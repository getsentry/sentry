import {IncidentFixture} from 'sentry-fixture/incident';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import IncidentRedirect from './incidentRedirect';

jest.mock('sentry/utils/analytics');

describe('IncidentRedirect', () => {
  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/issues/alerts/123/',
    },
    route: '/organizations/:orgId/issues/alerts/:alertId/',
  };
  const project = ProjectFixture();
  const mockIncident = IncidentFixture({projects: [project.slug]});

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/',
      body: mockIncident,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('redirects to alert details page', async () => {
    const {router} = render(<IncidentRedirect />, {
      initialRouterConfig,
    });

    expect(trackAnalytics).toHaveBeenCalledWith(
      'alert_details.viewed',
      expect.objectContaining({
        alert_id: 123,
      })
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/alerts/rules/details/4/',
          query: {
            alert: '123',
          },
        })
      );
    });
  });
});
