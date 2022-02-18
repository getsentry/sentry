import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import IncidentRedirect from 'sentry/views/alerts/incidentRedirect';

jest.mock('sentry/utils/analytics');

describe('IncidentRedirect', () => {
  const params = {orgId: 'org-slug', alertId: '123'};
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
    mountWithTheme(<IncidentRedirect params={params} organization={organization} />, {
      context: routerContext,
    });

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'alert_details.viewed',
      eventName: 'Alert Details: Viewed',
      organization_id: 3,
      alert_id: 123,
    });

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
