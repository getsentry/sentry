import fetchMock from 'jest-fetch-mock';
import {ServiceIncidentFixture} from 'sentry-fixture/serviceIncident';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/nav/primary/serviceIncidents';

describe('PrimaryNavigationServiceIncidents', () => {
  beforeEach(() => {
    ConfigStore.set('statuspage', {
      id: 'sentry',
      api_host: 'status.sentry.io',
    });
  });

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('should not show anything if there are no incidents', async () => {
    const mockFetchIncidents = fetchMock.mockResponse(req =>
      req.url.endsWith('incidents/unresolved.json')
        ? Promise.resolve(JSON.stringify({incidents: []}))
        : Promise.reject(new Error('not found'))
    );

    render(<PrimaryNavigationServiceIncidents />);

    await waitFor(() => {
      expect(mockFetchIncidents).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole('button', {name: 'Service status'})
    ).not.toBeInTheDocument();
  });

  it('displays button and list of incidents when clicked', async () => {
    const incident = ServiceIncidentFixture();

    fetchMock.mockResponse(req =>
      req.url.endsWith('incidents/unresolved.json')
        ? Promise.resolve(JSON.stringify({incidents: [incident]}))
        : Promise.reject(new Error('not found'))
    );

    render(<PrimaryNavigationServiceIncidents />);

    await userEvent.click(await screen.findByRole('button', {name: 'Service status'}));

    expect(await screen.findByText(incident.name)).toBeInTheDocument();
    expect(screen.getByText('Things look bad')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
  });
});
