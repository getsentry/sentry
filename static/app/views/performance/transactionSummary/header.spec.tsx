import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {PlatformKey} from 'sentry/types/platform';
import {EventView} from 'sentry/utils/discover/eventView';
import {TopBar} from 'sentry/views/navigation/topBar';
import {TransactionHeader} from 'sentry/views/performance/transactionSummary/header';
import {Tab} from 'sentry/views/performance/transactionSummary/tabs';

const TRANSACTION_NAME = 'transaction_name';

type InitialOpts = {
  features?: string[];
  platform?: PlatformKey;
};

function initializeData(opts?: InitialOpts) {
  const {features, platform} = opts ?? {};
  const teams = [
    TeamFixture({id: '1', slug: 'team1', name: 'Team 1'}),
    TeamFixture({id: '2', slug: 'team2', name: 'Team 2'}),
  ];
  const project = ProjectFixture({platform, teams});
  const organization = OrganizationFixture({
    features: features ?? [],
  });

  ProjectsStore.loadInitialData([project]);
  TeamStore.loadInitialData(teams, false, null);

  const router = RouterFixture({
    location: {
      query: {
        project: project.id,
      },
    },
  });
  const eventView = EventView.fromSavedQuery({
    id: undefined,
    version: 2,
    name: '',
    fields: ['transaction.status'], // unused fields
    projects: [parseInt(project.id, 10)],
  });
  return {
    project,
    organization,
    router,
    eventView,
    teams,
  };
}

// The header renders into TopBar slots, so the bar has to be mounted alongside
// it for the breadcrumbs and title to appear.
function renderHeader(data = initializeData()) {
  const {project, organization, router, eventView} = data;

  return render(
    <TopBar.Slot.Provider>
      <TopBar />
      <TransactionHeader
        eventView={eventView}
        location={router.location}
        organization={organization}
        projects={[project]}
        projectId={project.id}
        transactionName={TRANSACTION_NAME}
        currentTab={Tab.TRANSACTION_SUMMARY}
      />
    </TopBar.Slot.Provider>,
    {organization}
  );
}

describe('Performance > Transaction Summary Header', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      body: {threshold: '800', metric: 'lcp'},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/key-transactions-list/',
      body: [],
    });
  });

  it('should render', async () => {
    renderHeader();

    expect(await screen.findByRole('tab', {name: 'Overview'})).toBeInTheDocument();
  });

  it('renders the transaction as the page title, below its parent crumb', async () => {
    renderHeader();

    expect(
      await screen.findByRole('link', {name: 'Transaction Summary'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: TRANSACTION_NAME, level: 1})
    ).toBeInTheDocument();
  });

  it('offers the star and threshold actions from the title menu', async () => {
    renderHeader();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Transaction Actions'})
    );

    expect(
      await screen.findByRole('menuitemradio', {name: 'Star for Team'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Transaction Settings'})
    ).toBeInTheDocument();
  });

  it('disables the star action until the viewer teams have finished loading', async () => {
    const data = initializeData();
    // TeamStore is global and already holds teams here, but `hasMore` leaves
    // `loadedUserTeams` false — so the list is not yet known to be complete.
    // Holding the response open pins that state.
    TeamStore.loadInitialData(data.teams, true, null);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-teams/',
      body: data.teams,
      asyncDelay: new Promise<void>(() => {}),
    });

    renderHeader(data);

    await userEvent.click(
      await screen.findByRole('button', {name: 'Transaction Actions'})
    );

    expect(
      await screen.findByRole('menuitemradio', {name: 'Star for Team'})
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('lists the project teams in the star submenu', async () => {
    const data = initializeData();
    renderHeader(data);

    await userEvent.click(
      await screen.findByRole('button', {name: 'Transaction Actions'})
    );

    // Submenus open on hover, not on click.
    await userEvent.hover(
      await screen.findByRole('menuitemradio', {name: 'Star for Team'})
    );

    for (const team of data.teams) {
      expect(
        await screen.findByRole('menuitemradio', {name: `#${team.slug}`})
      ).toBeInTheDocument();
    }
  });
});
