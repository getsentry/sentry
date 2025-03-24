import fetchMock from 'jest-fetch-mock';
import {ServiceIncidentFixture} from 'sentry-fixture/serviceIncident';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PrimaryNavigationServiceIncidents} from 'sentry/components/nav/primary/serviceIncidents';
import ConfigStore from 'sentry/stores/configStore';

describe('PrimaryNavigationServiceIncidents', function () {
  beforeEach(() => {
    ConfigStore.set('statuspage', {
      id: 'sentry',
      api_host: 'status.sentry.io',
    });
  });

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('should not show anything if there are no incidents', async function () {
    const mockFetchIncidents = fetchMock.mockResponse(req =>
      req.url.endsWith('incidents/unresolved.json')
        ? Promise.resolve(JSON.stringify({incidents: []}))
        : Promise.reject()
    );

    render(<PrimaryNavigationServiceIncidents />);

    await waitFor(() => {
      expect(mockFetchIncidents).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole('button', {name: 'Service status'})
    ).not.toBeInTheDocument();
  });

  it('displays button and list of incidents when clicked', async function () {
    const incident = ServiceIncidentFixture();

    fetchMock.mockResponse(req =>
      req.url.endsWith('incidents/unresolved.json')
        ? Promise.resolve(JSON.stringify({incidents: [incident]}))
        : Promise.reject()
    );

    render(<PrimaryNavigationServiceIncidents />);

    await userEvent.click(await screen.findByRole('button', {name: 'Service status'}));

    expect(await screen.findByText(incident.name)).toBeInTheDocument();
    expect(screen.getByText('Things look bad')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
  });
});
