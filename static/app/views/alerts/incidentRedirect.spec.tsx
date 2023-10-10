import {browserHistory} from 'react-router';
import {Incident} from 'sentry-fixture/incident';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import IncidentRedirect from './incidentRedirect';

jest.mock('sentry/utils/analytics');

describe('IncidentRedirect', () => {
  const params = {alertId: '123'};
  const {organization, project, routerContext, routerProps} = initializeOrg({
    router: {
      params,
    },
  });
  const mockIncident = Incident({projects: [project.slug]});

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
    render(<IncidentRedirect organization={organization} {...routerProps} />, {
      context: routerContext,
    });

    expect(trackAnalytics).toHaveBeenCalledWith(
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
