import fetchMock from 'jest-fetch-mock';
import {ServiceIncidentFixture} from 'sentry-fixture/serviceIncident';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/navigation/primary/serviceIncidents';

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

  it.each([
    {status: 'investigating' as const, expectedVariant: 'danger'},
    {status: 'identified' as const, expectedVariant: 'accent'},
    {status: 'monitoring' as const, expectedVariant: 'warning'},
  ])(
    'shows $expectedVariant indicator when latest update is $status',
    async ({status, expectedVariant}) => {
      const incident = ServiceIncidentFixture({
        incident_updates: [
          {
            id: 'older',
            incident_id: '1',
            status: 'investigating',
            body: 'Older investigation update',
            affected_components: [],
            created_at: '2022-05-23T12:00:00.000-07:00',
            updated_at: '2022-05-23T12:00:00.000-07:00',
            display_at: '2022-05-23T12:00:00.000-07:00',
          },
          {
            id: 'latest',
            incident_id: '1',
            status,
            body: 'Latest update',
            affected_components: [],
            created_at: '2022-05-23T18:00:00.000-07:00',
            updated_at: '2022-05-23T18:00:00.000-07:00',
            display_at: '2022-05-23T18:00:00.000-07:00',
          },
        ],
      });

      fetchMock.mockResponse(req =>
        req.url.endsWith('incidents/unresolved.json')
          ? Promise.resolve(JSON.stringify({incidents: [incident]}))
          : Promise.reject(new Error('not found'))
      );

      render(<PrimaryNavigationServiceIncidents />);

      await screen.findByRole('button', {name: 'Service status'});
      const indicator = await screen.findByTestId('primary-nav-unread-indicator');
      expect(indicator).toHaveAttribute('data-variant', expectedVariant);
    }
  );

  it('uses the most recent update across multiple incidents', async () => {
    const olderIncident = ServiceIncidentFixture({
      id: 'older',
      name: 'Older incident',
      incident_updates: [
        {
          id: 'older-update',
          incident_id: 'older',
          status: 'investigating',
          body: 'Investigating older incident',
          affected_components: [],
          created_at: '2022-05-23T12:00:00.000-07:00',
          updated_at: '2022-05-23T12:00:00.000-07:00',
          display_at: '2022-05-23T12:00:00.000-07:00',
        },
      ],
    });
    const newerIncident = ServiceIncidentFixture({
      id: 'newer',
      name: 'Newer incident',
      incident_updates: [
        {
          id: 'newer-update',
          incident_id: 'newer',
          status: 'monitoring',
          body: 'Monitoring newer incident',
          affected_components: [],
          created_at: '2022-05-23T18:00:00.000-07:00',
          updated_at: '2022-05-23T18:00:00.000-07:00',
          display_at: '2022-05-23T18:00:00.000-07:00',
        },
      ],
    });

    fetchMock.mockResponse(req =>
      req.url.endsWith('incidents/unresolved.json')
        ? Promise.resolve(JSON.stringify({incidents: [olderIncident, newerIncident]}))
        : Promise.reject(new Error('not found'))
    );

    render(<PrimaryNavigationServiceIncidents />);

    await screen.findByRole('button', {name: 'Service status'});
    const indicator = await screen.findByTestId('primary-nav-unread-indicator');
    expect(indicator).toHaveAttribute('data-variant', 'warning');
  });
});
