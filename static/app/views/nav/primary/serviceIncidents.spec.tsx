import {http, HttpResponse} from 'msw';
import {ServiceIncidentFixture} from 'sentry-fixture/serviceIncident';

import {server} from 'sentry-test/msw';
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

  it('should not show anything if there are no incidents', async () => {
    const resolver = jest.fn(() => HttpResponse.json({incidents: []}));
    server.use(http.get('*incidents/unresolved.json', resolver));

    render(<PrimaryNavigationServiceIncidents />);

    await waitFor(() => {
      expect(resolver).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole('button', {name: 'Service status'})
    ).not.toBeInTheDocument();
  });

  it('displays button and list of incidents when clicked', async () => {
    const incident = ServiceIncidentFixture();

    server.use(
      http.get('*incidents/unresolved.json', () =>
        HttpResponse.json({incidents: [incident]})
      )
    );

    render(<PrimaryNavigationServiceIncidents />);

    await userEvent.click(await screen.findByRole('button', {name: 'Service status'}));

    expect(await screen.findByText(incident.name)).toBeInTheDocument();
    expect(screen.getByText('Things look bad')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
  });
});
