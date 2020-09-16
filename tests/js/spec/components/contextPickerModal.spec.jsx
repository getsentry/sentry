import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import ContextPickerModal from 'app/components/contextPickerModal';
import OrganizationStore from 'app/stores/organizationStore';
import OrganizationsStore from 'app/stores/organizationsStore';
import ProjectsStore from 'app/stores/projectsStore';

jest.mock('jquery');

describe('ContextPickerModal', function() {
  let project, project2, org, org2;
  const onFinish = jest.fn();

  beforeEach(function() {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
    onFinish.mockReset();

    project = TestStubs.Project();
    org = TestStubs.Organization({projects: [project]});
    project2 = TestStubs.Project({slug: 'project2'});
    org2 = TestStubs.Organization({
      slug: 'org2',
      id: '21',
    });
  });

  afterEach(async function() {
    OrganizationsStore.load([]);
    OrganizationStore.reset();
    await tick();
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

  it('renders with only org selector when no org is selected', async function() {
    const wrapper = mountWithTheme(getComponent());

    expect(wrapper.find('StyledSelectControl[name="organization"]').exists()).toBe(true);
    expect(wrapper.find('StyledSelectControl[name="project"]').exists()).toBe(false);

    await tick();
    wrapper.unmount();
  });

  it('calls onFinish, if project id is not needed, and only 1 org', async function() {
    OrganizationsStore.load([org2]);
    OrganizationStore.onUpdate(org2);
    MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/projects/`,
      body: [],
    });
    const wrapper = mountWithTheme(getComponent(), TestStubs.routerContext());

    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/');
    await tick();
    wrapper.unmount();
  });

  it('calls onFinish if there is only 1 org and 1 project', async function() {
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
      }),
      TestStubs.routerContext()
    );

    expect(fetchProjectsForOrg).toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(onFinish).toHaveBeenLastCalledWith('/test/org2/path/project2/');

    await tick();
    wrapper.unmount();
  });

  it('selects an org and calls `onFinish` with URL with organization slug', async function() {
    OrganizationsStore.load([org]);
    const wrapper = mountWithTheme(getComponent({}), TestStubs.routerContext());
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

  it('renders with project selector and org selector selected when org is already selected', async function() {
    OrganizationStore.onUpdate(org);
    const fetchProjectsForOrg = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [project, project2],
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
      {value: project.slug, label: project.slug},
      {value: project2.slug, label: project2.slug},
    ]);

    await tick();
    wrapper.unmount();
  });

  it('can select org and project', async function() {
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
      }),
      TestStubs.routerContext()
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
      {value: project2.slug, label: project2.slug},
      {value: 'project3', label: 'project3'},
    ]);

    // Select project3
    selectByValue(wrapper, 'project3', {control: true, name: 'project'});

    expect(onFinish).toHaveBeenCalledWith('/test/org2/path/project3/');

    await tick();
    wrapper.unmount();
  });
});
