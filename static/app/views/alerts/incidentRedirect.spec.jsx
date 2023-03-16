import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import IncidentRedirect from 'sentry/views/alerts/incidentRedirect';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('IncidentRedirect', () => {
  const params = {alertId: '123'};
  const {organization, project, routerContext} = initializeOrg({
    router: {
      params,
    },
  });
  const mockIncident = TestStubs.Incident({projects: [project.slug]});

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/123/',
      body: mockIncident,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
  });

  it('redirects to alert details page', async () => {
    render(<IncidentRedirect params={params} organization={organization} />, {
      context: routerContext,
    });

    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
      'alert_details.viewed',
      expect.objectContaining({
        alert_id: 123,
      })
    );

    await waitFor(() => {
      expect(browserHistory.replace).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/alerts/rules/details/4/',
        query: {
          alert: '123',
        },
      });
    });
  });
});
