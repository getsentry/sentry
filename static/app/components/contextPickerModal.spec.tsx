import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ContextPickerModal from 'sentry/components/contextPickerModal';
import {
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';

describe('ContextPickerModal', () => {
  let project!: Project;
  let project2!: Project;
  let project4!: Project;
  let org!: Organization;
  let org2!: Organization;
  const onFinish = jest.fn();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    project = ProjectFixture();
    org = OrganizationFixture();
    project2 = ProjectFixture({slug: 'project2'});
    org2 = OrganizationFixture({
      slug: 'org2',
      id: '21',
    });
    project4 = ProjectFixture({slug: 'project4', isMember: false});

    OrganizationsStore.load([]);
    OrganizationStore.reset();

    jest.clearAllMocks();
  });

  const getComponent = (
    props: Partial<React.ComponentProps<typeof ContextPickerModal>> = {}
  ) => (
    <ContextPickerModal
      Header={headerProps => <div>{headerProps.children}</div>}
      Body={ModalBody}
      nextPath="/test/:orgId/path/"
      needOrg
      onFinish={onFinish}
      needProject={false}
      needTeam={false}
      CloseButton={makeCloseButton(() => {})}
      Footer={ModalFooter}
      closeModal={jest.fn()}
      {...props}
    />
  );

  it('renders with only org selector when no org is selected', () => {
    render(getComponent());

    expect(screen.getByText('Select an Organization')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(screen.queryByText('Select a Project to continue')).not.toBeInTheDocument();
  });

  it('calls onFinish, if project id is not needed, and only 1 org', async () => {
    OrganizationsStore.load([org2]);
    OrganizationStore.onUpdate(org2);
    MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [],
    });

    render(getComponent());

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith('/test/org2/path/');
    });
  });

  it('calls onFinish if there is only 1 org and 1 project', async () => {
    OrganizationsStore.load([org2]);
    OrganizationStore.onUpdate(org2);

    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [project2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
      })
    );

    await waitFor(() => {
      expect(fetchProjectsForOrg).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onFinish).toHaveBeenLastCalledWith('/test/org2/path/project2/');
    });
  });

  it('selects an org and calls `onFinish` with URL with organization slug', async () => {
    OrganizationsStore.load([org]);
    render(getComponent());
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    await selectEvent.select(screen.getByText('Select an Organization'), 'org-slug');

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith('/test/org-slug/path/');
    });
  });

  it('renders with project selector and org selector selected when org is already selected', async () => {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [project, project2, project4],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: true,
      })
    );

    await waitFor(() => {
      expect(fetchProjectsForOrg).toHaveBeenCalled();
    });

    // Default to org in latest context
    // Should see 1 selected, and 1 as an option
    expect(screen.getAllByText('org-slug')).toHaveLength(2);

    // Wait for projects to load before checking focus
    expect(await screen.findByText('My Projects')).toBeInTheDocument();
    // Project selector should have focus (there are two textboxes: org and project)
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes[1]).toHaveFocus();
    expect(screen.getByText(project.slug)).toBeInTheDocument();
    expect(screen.getByText(project2.slug)).toBeInTheDocument();
    expect(screen.getByText('All Projects')).toBeInTheDocument();
    expect(screen.getByText(project4.slug)).toBeInTheDocument();
  });

  it('can select org and project', async () => {
    const organizations = [
      {
        ...org,
        projects: [project],
      },
      {
        ...org2,
        projects: [project2, ProjectFixture({slug: 'project3'})],
      },
    ];
    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: organizations[1]!.projects,
    });

    OrganizationsStore.load(organizations);

    render(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
      })
    );

    // Should not have anything selected
    expect(screen.getByText('Select an Organization')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();

    // Select org2
    await selectEvent.select(screen.getByText('Select an Organization'), org2.slug);
    // <Projects> will fetch projects for org2
    expect(fetchProjectsForOrg).toHaveBeenCalled();

    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.getByText(project2.slug)).toBeInTheDocument();
    expect(screen.getByText('project3')).toBeInTheDocument();
    expect(screen.queryByText('All Projects')).not.toBeInTheDocument();

    // Select project3
    await selectEvent.select(screen.getByText(/Select a Project/), 'project3');

    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/project3/');
  });

  it('updates project list when switching organizations', async () => {
    const orgProject = ProjectFixture({slug: 'org1-project'});
    const org2Project = ProjectFixture({slug: 'org2-project'});

    OrganizationsStore.load([org, org2]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [orgProject],
    });
    const fetchProjectsForOrg2 = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [org2Project],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
      })
    );

    // Initially should show org1's project
    expect(await screen.findByText('org1-project')).toBeInTheDocument();
    expect(screen.queryByText('org2-project')).not.toBeInTheDocument();

    // Switch to org2
    await selectEvent.select(screen.getAllByText(org.slug)[0]!, org2.slug);

    // Should now show org2's project
    expect(fetchProjectsForOrg2).toHaveBeenCalled();
    expect(await screen.findByText('org2-project')).toBeInTheDocument();
    expect(screen.queryByText('org1-project')).not.toBeInTheDocument();
  });

  it('isSuperUser and selects an integrationConfig and calls `onFinish` with URL to that configuration', async () => {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.set('user', UserFixture({isSuperuser: true}));

    const provider = {slug: 'github'};
    const configQueryKey = [
      getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
        path: {organizationIdOrSlug: org.slug},
      }),
      {query: {provider_key: provider.slug, includeConfig: 0}},
    ] satisfies ApiQueryKey;
    const integration = GitHubIntegrationFixture();
    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configQueryKey[0],
      body: [integration],
      match: [MockApiClient.matchQuery(configQueryKey[1].query)],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    render(
      getComponent({
        needOrg: false,
        needProject: false,
        nextPath: `/settings/${org.slug}/integrations/${provider.slug}/`,
        configQueryKey,
      })
    );

    await waitFor(() => {
      expect(fetchGithubConfigs).toHaveBeenCalled();
    });

    if (integration.domainName === null) {
      throw new Error('Integration domainName is null');
    }

    await selectEvent.select(screen.getByRole('textbox'), integration.domainName);
    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org.slug}/integrations/github/${integration.id}/`
    );
  });

  it('not superUser and cannot select an integrationConfig and calls `onFinish` with URL to integration overview page', async () => {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.set('user', UserFixture({isSuperuser: false}));

    const provider = {slug: 'github'};
    const configQueryKey = [
      getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
        path: {organizationIdOrSlug: org.slug},
      }),
      {query: {provider_key: provider.slug, includeConfig: 0}},
    ] satisfies ApiQueryKey;

    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configQueryKey[0],
      body: [GitHubIntegrationFixture()],
      match: [MockApiClient.matchQuery(configQueryKey[1].query)],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    render(
      getComponent({
        needOrg: false,
        needProject: false,
        nextPath: `/settings/${org.slug}/integrations/${provider.slug}/`,
        configQueryKey,
      })
    );

    await waitFor(() => {
      expect(fetchGithubConfigs).toHaveBeenCalled();
    });
  });

  it('is superUser and no integration configurations and calls `onFinish` with URL to integration overview page', async () => {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.set('user', UserFixture({isSuperuser: false}));

    const provider = {slug: 'github'};
    const configQueryKey = [
      getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
        path: {organizationIdOrSlug: org.slug},
      }),
      {query: {provider_key: provider.slug, includeConfig: 0}},
    ] satisfies ApiQueryKey;

    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configQueryKey[0],
      body: [],
      match: [MockApiClient.matchQuery(configQueryKey[1].query)],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    render(
      getComponent({
        needOrg: false,
        needProject: false,
        nextPath: `/settings/${org.slug}/integrations/${provider.slug}/`,
        configQueryKey,
      })
    );

    await waitFor(() => {
      expect(fetchGithubConfigs).toHaveBeenCalled();
    });

    expect(onFinish).toHaveBeenCalledWith(`/settings/${org.slug}/integrations/github/`);
  });

  it('preserves path object query parameters', async () => {
    OrganizationsStore.load([org2]);
    OrganizationStore.onUpdate(org2);

    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [project2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: {
          pathname: '/test/:orgId/path/:projectId/',
          query: {referrer: 'onboarding_task'},
        },
      })
    );

    await waitFor(() => expect(fetchProjectsForOrg).toHaveBeenCalled());
    expect(onFinish).toHaveBeenLastCalledWith({
      pathname: '/test/org2/path/project2/',
      query: {referrer: 'onboarding_task'},
    });
  });

  it('renders team picker when needTeam is true', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: false,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    expect(await screen.findByText('Select a Team to continue')).toBeInTheDocument();
    expect(screen.getByText(`#${team1.slug}`)).toBeInTheDocument();
    expect(screen.getByText(`#${team2.slug}`)).toBeInTheDocument();
  });

  it('renders org and team header when both are required', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Select an organization and a team to continue',
      })
    ).toBeInTheDocument();
  });

  it('shows team picker when org is pre-selected and needTeam is true', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});

    // Real-world scenario: single org, already selected
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    const fetchTeams = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    // Teams should be fetched for the pre-selected org
    await waitFor(() => {
      expect(fetchTeams).toHaveBeenCalled();
    });

    // Team picker should appear
    expect(await screen.findByText(`#${team1.slug}`)).toBeInTheDocument();
    expect(screen.getByText(`#${team2.slug}`)).toBeInTheDocument();

    // Select a team
    await selectEvent.select(screen.getByText(/Select a Team/), `#${team1.slug}`);

    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org.slug}/teams/${team1.slug}/settings/`
    );
  });

  it('can select org and then team', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});

    OrganizationsStore.load([org, org2]);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    const fetchTeamsForOrg2 = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    // Should not have anything selected
    expect(screen.getByText('Select an Organization')).toBeInTheDocument();

    // Select org2
    await selectEvent.select(screen.getByText('Select an Organization'), org2.slug);

    // TeamsForOrg should fetch teams for org2
    expect(fetchTeamsForOrg2).toHaveBeenCalled();

    // Team picker should appear with teams from org2
    expect(await screen.findByText(`#${team1.slug}`)).toBeInTheDocument();
    expect(screen.getByText(`#${team2.slug}`)).toBeInTheDocument();

    // Select a team
    await selectEvent.select(screen.getByText(/Select a Team/), `#${team2.slug}`);

    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org2.slug}/teams/${team2.slug}/settings/`
    );
  });

  it('updates team list when switching organizations', async () => {
    const team1 = TeamFixture({id: '1', slug: 'org1-team'});
    const team2 = TeamFixture({id: '2', slug: 'org2-team'});

    OrganizationsStore.load([org, org2]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [],
    });
    const fetchTeamsForOrg2 = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/teams/`,
      body: [team2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    // Initially should show org1's team
    expect(await screen.findByText(`#${team1.slug}`)).toBeInTheDocument();
    expect(screen.queryByText(`#${team2.slug}`)).not.toBeInTheDocument();

    // Switch to org2 — org.slug appears twice (selected value + option), use getAllByText
    await selectEvent.select(screen.getAllByText(org.slug)[0]!, org2.slug);

    // Should now show org2's team
    expect(fetchTeamsForOrg2).toHaveBeenCalled();
    expect(await screen.findByText(`#${team2.slug}`)).toBeInTheDocument();
    expect(screen.queryByText(`#${team1.slug}`)).not.toBeInTheDocument();
  });

  it('selects a team and navigates to the correct path', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: false,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    await selectEvent.select(await screen.findByText(/Select a Team/), `#${team2.slug}`);

    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org.slug}/teams/${team2.slug}/settings/`
    );
  });

  it('auto-navigates when only one team exists', async () => {
    const team1 = TeamFixture({id: '1', slug: 'the-only-team'});
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1],
    });

    render(
      getComponent({
        needOrg: false,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith(
        `/settings/${org.slug}/teams/the-only-team/settings/`
      );
    });
  });

  it('focuses team selector (not org) when needOrg and needTeam', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});

    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: false,
        needTeam: true,
        nextPath: '/settings/:orgId/teams/:teamId/settings/',
      })
    );

    // Wait for teams to load
    expect(await screen.findByText(`#${team1.slug}`)).toBeInTheDocument();

    // Team selector should have focus, not the org selector
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes[1]).toHaveFocus();
  });

  it('navigates when selecting project first then team', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});

    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [project, project2],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: true,
        needTeam: true,
        nextPath: '/settings/:orgId/path/:projectId/teams/:teamId/',
      })
    );

    // Wait for both selectors to load
    expect(await screen.findByText('My Projects')).toBeInTheDocument();
    expect(await screen.findByText(`#${team1.slug}`)).toBeInTheDocument();

    // Select project first — should NOT navigate yet (team not selected)
    await selectEvent.select(screen.getByText(/Select a Project/), project.slug);
    expect(onFinish).not.toHaveBeenCalled();

    // Select team — should navigate with both project and team
    await selectEvent.select(screen.getByText(/Select a Team/), `#${team1.slug}`);
    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org.slug}/path/${project.slug}/teams/${team1.slug}/`
    );
  });

  it('navigates when selecting team first then project', async () => {
    const team1 = TeamFixture({id: '1', slug: 'team-one'});
    const team2 = TeamFixture({id: '2', slug: 'team-two'});

    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [project, project2],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team1, team2],
    });

    render(
      getComponent({
        needOrg: true,
        needProject: true,
        needTeam: true,
        nextPath: '/settings/:orgId/path/:projectId/teams/:teamId/',
      })
    );

    // Wait for both selectors to load
    expect(await screen.findByText('My Projects')).toBeInTheDocument();
    expect(await screen.findByText(`#${team1.slug}`)).toBeInTheDocument();

    // Select team first — should NOT navigate yet (project not selected)
    await selectEvent.select(screen.getByText(/Select a Team/), `#${team2.slug}`);
    expect(onFinish).not.toHaveBeenCalled();

    // Select project — should navigate with both project and team
    await selectEvent.select(screen.getByText(/Select a Project/), project2.slug);
    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org.slug}/path/${project2.slug}/teams/${team2.slug}/`
    );
  });
});
