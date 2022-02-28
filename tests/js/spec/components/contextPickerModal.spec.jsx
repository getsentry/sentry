import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';
import {selectByValue} from 'sentry-test/select-new';

import ContextPickerModal from 'sentry/components/contextPickerModal';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('ContextPickerModal', function () {
  let project, project2, project4, org, org2;
  const onFinish = jest.fn();

  beforeEach(function () {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
    onFinish.mockReset();

    project = TestStubs.Project();
    org = TestStubs.Organization({projects: [project]});
    project2 = TestStubs.Project({slug: 'project2'});
    org2 = TestStubs.Organization({
      slug: 'org2',
      id: '21',
    });
    project4 = TestStubs.Project({slug: 'project4', isMember: false});
  });

  afterEach(async function () {
    act(() => OrganizationsStore.load([]));
    act(() => OrganizationStore.reset());
    await act(tick);
  });

  const getComponent = props => (
    <ContextPickerModal
      Header={() => <div />}
      Body="div"
      nextPath="/test/:orgId/path/"
      organizations={[org, org2]}
      needOrg
      onFinish={onFinish}
      {...props}
    />
  );

  it('renders with only org selector when no org is selected', async function () {
    const wrapper = mountWithTheme(getComponent());

    expect(wrapper.find('StyledSelectControl[name="organization"]').exists()).toBe(true);
    expect(wrapper.find('StyledSelectControl[name="project"]').exists()).toBe(false);

    await tick();
    wrapper.unmount();
  });

  it('calls onFinish, if project id is not needed, and only 1 org', async function () {
    OrganizationsStore.load([org2]);
    OrganizationStore.onUpdate(org2);
    MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [],
    });
    const wrapper = mountWithTheme(getComponent());

    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/');
    await tick();
    wrapper.unmount();
  });

  it('calls onFinish if there is only 1 org and 1 project', async function () {
    expect(onFinish).not.toHaveBeenCalled();
    OrganizationsStore.load([org2]);
    OrganizationStore.onUpdate(org2);

    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [project2],
    });

    const wrapper = mountWithTheme(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
      })
    );

    expect(fetchProjectsForOrg).toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();

    await act(tick);
    wrapper.update();

    expect(onFinish).toHaveBeenLastCalledWith('/test/org2/path/project2/');

    await tick();
    wrapper.unmount();
  });

  it('selects an org and calls `onFinish` with URL with organization slug', async function () {
    OrganizationsStore.load([org]);
    const wrapper = mountWithTheme(getComponent({}));
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    selectByValue(wrapper, 'org-slug', {control: true});

    await tick();
    wrapper.update();
    expect(onFinish).toHaveBeenCalledWith('/test/org-slug/path/');

    await tick();
    wrapper.unmount();
  });

  it('renders with project selector and org selector selected when org is already selected', async function () {
    OrganizationStore.onUpdate(org);
    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [project, project2, project4],
    });
    await tick();

    const wrapper = mountWithTheme(
      getComponent({
        needOrg: true,
        needProject: true,
      })
    );

    await tick();
    wrapper.update();

    expect(fetchProjectsForOrg).toHaveBeenCalled();

    // Default to org in latest context
    expect(wrapper.find('StyledSelectControl[name="organization"]').prop('value')).toBe(
      org.slug
    );

    expect(wrapper.find('StyledSelectControl[name="project"]').prop('options')).toEqual([
      {
        label: 'My Projects',
        options: [
          {
            value: project.slug,
            label: project.slug,
            isDisabled: false,
          },
          {
            value: project2.slug,
            label: project2.slug,
            isDisabled: false,
          },
        ],
      },
      {
        label: 'All Projects',
        options: [
          {
            value: project4.slug,
            label: project4.slug,
            isDisabled: true,
          },
        ],
      },
    ]);

    await act(tick);
    wrapper.unmount();
  });

  it('can select org and project', async function () {
    const organizations = [
      {
        ...org,
        projects: [project],
      },
      {
        ...org2,
        projects: [project2, TestStubs.Project({slug: 'project3'})],
      },
    ];
    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: organizations[1].projects,
    });

    OrganizationsStore.load(organizations);

    const wrapper = mountWithTheme(
      getComponent({
        needOrg: true,
        needProject: true,
        nextPath: '/test/:orgId/path/:projectId/',
        organizations,
      })
    );

    await tick();
    wrapper.update();

    // Should not have anything selected
    expect(
      wrapper.find('StyledSelectControl[name="organization"]').prop('value')
    ).toBeUndefined();

    // Select org2
    selectByValue(wrapper, org2.slug, {control: true});

    await tick();
    wrapper.update();

    // <Projects> will fetch projects for org2
    expect(fetchProjectsForOrg).toHaveBeenCalled();

    expect(wrapper.find('StyledSelectControl[name="project"]').prop('options')).toEqual([
      {
        label: 'My Projects',
        options: [
          {
            value: project2.slug,
            label: project2.slug,
            isDisabled: false,
          },
          {
            value: 'project3',
            label: 'project3',
            isDisabled: false,
          },
        ],
      },
      {
        label: 'All Projects',
        options: [],
      },
    ]);

    // Select project3
    selectByValue(wrapper, 'project3', {control: true, name: 'project'});

    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/project3/');

    await act(tick);
    wrapper.unmount();
  });

  it('isSuperUser and selects an integrationConfig and calls `onFinish` with URL to that configuration', async function () {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.config = {
      user: {isSuperuser: true},
    };

    const provider = {slug: 'github'};
    const configUrl = `/api/0/organizations/${org.slug}/integrations/?provider_key=${provider.slug}&includeConfig=0`;
    const integration = TestStubs.GitHubIntegration();
    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configUrl,
      body: [integration],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    const wrapper = mountWithTheme(
      getComponent({
        needOrg: false,
        needProject: false,
        nextPath: `/settings/${org.slug}/integrations/${provider.slug}/`,
        configUrl,
      })
    );

    expect(fetchGithubConfigs).toHaveBeenCalled();
    expect(wrapper.find('StyledSelectControl').prop('name')).toEqual('configurations');
    selectByValue(wrapper, integration.id, {control: true, name: 'configurations'});
    expect(onFinish).toHaveBeenCalledWith(
      `/settings/${org.slug}/integrations/github/${integration.id}/`
    );

    await tick();
    wrapper.unmount();
  });

  it('not superUser and cannot select an integrationConfig and calls `onFinish` with URL to integration overview page', async function () {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.config = {
      user: {isSuperuser: false},
    };

    const provider = {slug: 'github'};
    const configUrl = `/api/0/organizations/${org.slug}/integrations/?provider_key=${provider.slug}&includeConfig=0`;

    const fetchGithubConfigs = MockApiClient.addMockResponse({
      url: configUrl,
      body: [TestStubs.GitHubIntegration()],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    const wrapper = mountWithTheme(
      getComponent({
        needOrg: false,
        needProject: false,
        nextPath: `/settings/${org.slug}/integrations/${provider.slug}/`,
        configUrl,
      })
    );

    expect(fetchGithubConfigs).toHaveBeenCalled();
    expect(wrapper.find('StyledSelectControl').exists()).toBeFalsy();
    expect(onFinish).toHaveBeenCalledWith(`/settings/${org.slug}/integrations/github/`);

    await tick();
    wrapper.unmount();
  });

  it('is superUser and no integration configurations and calls `onFinish` with URL to integration overview page', async function () {
    OrganizationsStore.load([org]);
    OrganizationStore.onUpdate(org);
    ConfigStore.config = {
      user: {isSuperuser: true},
    };

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

    const wrapper = mountWithTheme(
      getComponent({
        needOrg: false,
        needProject: false,
        nextPath: `/settings/${org.slug}/integrations/${provider.slug}/`,
        configUrl,
      })
    );

    expect(fetchGithubConfigs).toHaveBeenCalled();
    expect(wrapper.find('StyledSelectControl').exists()).toBeFalsy();
    expect(onFinish).toHaveBeenCalledWith(`/settings/${org.slug}/integrations/github/`);

    await tick();
    wrapper.unmount();
  });
});
