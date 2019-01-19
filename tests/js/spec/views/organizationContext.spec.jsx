import React from 'react';

import {mount} from 'enzyme';
import {openSudo} from 'app/actionCreators/modal';
import ConfigStore from 'app/stores/configStore';
import OrganizationContext from 'app/views/organizationContext';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';

jest.mock('app/stores/configStore', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));
jest.mock('app/actionCreators/modal', () => ({
  openSudo: jest.fn(),
}));

describe('OrganizationContext', function() {
  let wrapper;
  let org = TestStubs.Organization({
    teams: [TestStubs.Team()],
    projects: [TestStubs.Project()],
  });
  let getOrgMock;

  beforeAll(function() {});

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: org,
    });
    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'loadInitialData');
    wrapper = mount(
      <OrganizationContext params={{orgId: 'org-slug'}}>{<div />}</OrganizationContext>
    );
  });

  afterEach(function() {
    TeamStore.loadInitialData.mockRestore();
    ProjectsStore.loadInitialData.mockRestore();
  });

  it('renders and fetches org', function() {
    expect(getOrgMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.anything()
    );

    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('error')).toBe(false);
    expect(wrapper.state('organization')).toEqual(org);

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(org.teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(org.projects);
  });

  it('resets TeamStore when unmounting', function() {
    jest.spyOn(TeamStore, 'reset');
    wrapper.unmount();
    expect(TeamStore.reset).toHaveBeenCalled();
    TeamStore.reset.mockRestore();
  });

  it('fetches new org when router params change', function() {
    let mock = MockApiClient.addMockResponse({
      url: '/organizations/new-slug/',
      body: org,
    });
    wrapper.setProps({params: {orgId: 'new-slug'}});
    wrapper.update();

    expect(mock).toHaveBeenLastCalledWith('/organizations/new-slug/', expect.anything());
  });

  it('fetches new org when router location state is `refresh`', function() {
    getOrgMock.mockReset();
    wrapper.setProps({location: {state: 'refresh'}});
    wrapper.update();

    expect(getOrgMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/',
      expect.anything()
    );
  });

  it('shows loading error for non-superusers on 403s', function() {
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    wrapper = mount(
      <OrganizationContext params={{orgId: 'org-slug'}}>{<div />}</OrganizationContext>
    );

    expect(wrapper.find('LoadingError')).toHaveLength(1);
  });

  it('opens sudo modal for superusers on 403s', function() {
    ConfigStore.get.mockImplementation(() => ({
      isSuperuser: true,
    }));
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    wrapper = mount(
      <OrganizationContext params={{orgId: 'org-slug'}}>{<div />}</OrganizationContext>
    );

    expect(openSudo).toHaveBeenCalled();
  });
});
