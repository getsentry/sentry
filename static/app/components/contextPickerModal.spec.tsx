import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
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
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

describe('ContextPickerModal', function () {
  let project!: Project;
  let project2!: Project;
  let project4!: Project;
  let org!: Organization;
  let org2!: Organization;
  const onFinish = jest.fn();

  beforeEach(function () {
    ProjectsStore.reset();
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

  const getComponent = (props = {}) => (
    <ContextPickerModal
      Header={() => <div />}
      Body={ModalBody}
      nextPath="/test/:orgId/path/"
      needOrg
      onFinish={onFinish}
      needProject={false}
      CloseButton={makeCloseButton(() => {})}
      Footer={ModalFooter}
      closeModal={jest.fn()}
      {...props}
    />
  );

  it('renders with only org selector when no org is selected', function () {
    render(getComponent());

    expect(screen.getByText('Select an Organization')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(screen.queryByText('Select a Project to continue')).not.toBeInTheDocument();
  });

  it('calls onFinish, if project id is not needed, and only 1 org', async function () {
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

  it('calls onFinish if there is only 1 org and 1 project', async function () {
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
      expect(onFinish).toHaveBeenLastCalledWith('/test/org2/path/project2/');
    });
  });

  it('selects an org and calls `onFinish` with URL with organization slug', async function () {
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

  it('renders with project selector and org selector selected when org is already selected', async function () {
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

    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(await screen.findByText('My Projects')).toBeInTheDocument();
    expect(screen.getByText(project.slug)).toBeInTheDocument();
    expect(screen.getByText(project2.slug)).toBeInTheDocument();
    expect(screen.getByText('All Projects')).toBeInTheDocument();
    expect(screen.getByText(project4.slug)).toBeInTheDocument();
  });

  it('can select org and project', async function () {
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
      body: organizations[1].projects,
    });

    OrganizationsStore.load(organizations);

    render(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
        organizations,
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

  it('isSuperUser and selects an integrationConfig and calls `onFinish` with URL to that configuration', async function () {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.set('user', UserFixture({isSuperuser: true}));

    const provider = {slug: 'github'};
    const configUrl = `/api/0/organizations/${org.slug}/integrations/?provider_key=${provider.slug}&includeConfig=0`;
    const integration = GitHubIntegrationFixture();
    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configUrl,
      body: [integration],
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
        configUrl,
      })
    );

    await waitFor(() => {
      expect(fetchGithubConfigs).toHaveBeenCalled();
    });

    if (integration.domainName === null) {
      throw new Error('Integration domainName is null');
    }

    await selectEvent.select(
      screen.getByText(/Select a configuration/i),
      integration.domainName
    );
    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org.slug}/integrations/github/${integration.id}/`
    );
  });

  it('not superUser and cannot select an integrationConfig and calls `onFinish` with URL to integration overview page', async function () {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.set('user', UserFixture({isSuperuser: false}));

    const provider = {slug: 'github'};
    const configUrl = `/api/0/organizations/${org.slug}/integrations/?provider_key=${provider.slug}&includeConfig=0`;

    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configUrl,
      body: [GitHubIntegrationFixture()],
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
        configUrl,
      })
    );

    await waitFor(() => {
      expect(fetchGithubConfigs).toHaveBeenCalled();
    });
  });

  it('is superUser and no integration configurations and calls `onFinish` with URL to integration overview page', async function () {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.set('user', UserFixture({isSuperuser: false}));

    const provider = {slug: 'github'};
    const configUrl = `/api/0/organizations/${org.slug}/integrations/?provider_key=${provider.slug}&includeConfig=0`;

    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configUrl,
      body: [],
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
        configUrl,
      })
    );

    await waitFor(() => {
      expect(fetchGithubConfigs).toHaveBeenCalled();
    });

    expect(onFinish).toHaveBeenCalledWith(`/settings/${org.slug}/integrations/github/`);
  });

  it('preserves path object query parameters', async function () {
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
});
