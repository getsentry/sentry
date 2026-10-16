import {MonitorFixture} from 'sentry-fixture/monitor';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {DetailsTimeline} from 'sentry/views/insights/crons/components/detailsTimeline';
import {MonitorStatus, type MonitorEnvironment} from 'sentry/views/insights/crons/types';

function makeEnvironment(name: string): MonitorEnvironment {
  return {
    activeIncident: null,
    dateCreated: '2023-01-01T00:10:00Z',
    isMuted: false,
    lastCheckIn: '2023-12-25T17:13:00Z',
    name,
    nextCheckIn: '2023-12-25T18:13:00Z',
    nextCheckInLatest: '2023-12-25T18:18:00Z',
    status: MonitorStatus.OK,
  };
}

describe('DetailsTimeline', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-stats/`,
      body: {},
    });
  });

  it('renders a row for each environment when the monitor has a few environments', () => {
    const monitor = MonitorFixture({
      project,
      environments: [makeEnvironment('production'), makeEnvironment('staging')],
    });

    render(<DetailsTimeline monitor={monitor} />, {organization});

    const table = screen.getByRole('table', {name: 'Check-in timeline'});
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(
      within(table).getByRole('columnheader', {name: 'Check-Ins'})
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', {name: 'Timeline'})
    ).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('production')).toBeInTheDocument();
    expect(within(table).getByText('staging')).toBeInTheDocument();
    expect(within(table).queryByRole('button', {name: /Show/})).not.toBeInTheDocument();
  });

  it('shows only the first four environments when the monitor has more', () => {
    const monitor = MonitorFixture({
      project,
      environments: ['a', 'b', 'c', 'd', 'e', 'f'].map(makeEnvironment),
    });

    render(<DetailsTimeline monitor={monitor} />, {organization});

    const table = screen.getByRole('table', {name: 'Check-in timeline'});
    expect(within(table).getByText('d')).toBeInTheDocument();
    expect(within(table).queryByText('e')).not.toBeInTheDocument();
    expect(within(table).getByRole('button', {name: 'Show 2 More'})).toBeInTheDocument();
  });

  it('shows the remaining environments when Show More is clicked', async () => {
    const monitor = MonitorFixture({
      project,
      environments: ['a', 'b', 'c', 'd', 'e', 'f'].map(makeEnvironment),
    });

    render(<DetailsTimeline monitor={monitor} />, {organization});

    const table = screen.getByRole('table', {name: 'Check-in timeline'});
    await userEvent.click(within(table).getByRole('button', {name: 'Show 2 More'}));

    expect(within(table).getByText('e')).toBeInTheDocument();
    expect(within(table).getByText('f')).toBeInTheDocument();
    expect(
      within(table).queryByRole('button', {name: 'Show 2 More'})
    ).not.toBeInTheDocument();
  });

  it('deletes the environment when the deletion is confirmed', async () => {
    const monitor = MonitorFixture({
      project,
      environments: [makeEnvironment('production'), makeEnvironment('staging')],
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/`,
      method: 'DELETE',
      body: {},
    });
    const onEnvironmentUpdated = jest.fn();

    render(
      <DetailsTimeline monitor={monitor} onEnvironmentUpdated={onEnvironmentUpdated} />,
      {organization}
    );
    renderGlobalModal();

    await userEvent.click(
      within(screen.getByRole('row', {name: /staging/})).getByRole('button', {
        name: 'Monitor environment actions',
      })
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Delete Environment'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));

    expect(deleteRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({method: 'DELETE', query: {environment: 'staging'}})
    );
    expect(onEnvironmentUpdated).toHaveBeenCalled();
  });

  it('links to the environment in the current time range when View Environment is chosen', async () => {
    const monitor = MonitorFixture({
      project,
      environments: [makeEnvironment('production'), makeEnvironment('staging')],
    });

    const {router} = render(<DetailsTimeline monitor={monitor} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/monitors/1/',
          query: {statsPeriod: '7d', project: '1'},
        },
      },
    });

    await userEvent.click(
      within(screen.getByRole('row', {name: /staging/})).getByRole('button', {
        name: 'Monitor environment actions',
      })
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'View Environment'})
    );

    expect(router.location.pathname).toBe('/monitors/1/');
    expect(router.location.query).toEqual({statsPeriod: '7d', environment: 'staging'});
  });
});
