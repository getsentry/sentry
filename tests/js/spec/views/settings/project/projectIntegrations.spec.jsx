import React from 'react';

import {mount} from 'enzyme';
import {
  removeIntegrationFromProject,
  addIntegrationToProject,
} from 'app/actionCreators/integrations';
import ProjectIntegrations from 'app/views/settings/project/projectIntegrations';

jest.mock('app/actionCreators/integrations');

describe('ProjectIntegrations', function() {
  let org, project, params, organization, routerContext;

  beforeEach(function() {
    project = TestStubs.Project();
    org = TestStubs.Organization();
    organization = org;
    params = {
      orgId: org.slug,
      projectId: project.slug,
    };
    routerContext = TestStubs.routerContext([{organization, project}]);

    removeIntegrationFromProject.mockReturnValue(new Promise(resolve => resolve()));
    addIntegrationToProject.mockReturnValue(new Promise(resolve => resolve()));
  });

  it('Renders emptystate with no permissions', function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      method: 'GET',
      body: [],
    });

    const wrapper = mount(<ProjectIntegrations params={params} />, routerContext);

    expect(wrapper).toMatchSnapshot();
  });

  it('Renders emptystate with access', function() {
    organization.access.push('org:integrations');

    const wrapper = mount(<ProjectIntegrations params={params} />, routerContext);

    expect(wrapper).toMatchSnapshot();
  });

  it('Renders integration without access', function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      method: 'GET',
      body: [TestStubs.JiraIntegration()],
    });

    const wrapper = mount(<ProjectIntegrations params={params} />, routerContext);

    expect(wrapper.find('Switch').prop('isDisabled')).toBe(true);
  });

  it('Renders integration with access', function() {
    organization.access.push('project:integrations');

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      method: 'GET',
      body: [TestStubs.JiraIntegration()],
    });

    const wrapper = mount(<ProjectIntegrations params={params} />, routerContext);
    const integration = wrapper.find('IntegrationItem');

    expect(integration.exists()).toBe(true);
    expect(wrapper.find('Switch').prop('isDisabled')).toBe(false);
  });

  it('can enable and disable an integration', async function() {
    organization.access.push('project:integrations');
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      method: 'GET',
      body: [TestStubs.JiraIntegration()],
    });

    const wrapper = mount(<ProjectIntegrations params={params} />, routerContext);

    wrapper.find('Switch').simulate('click');
    expect(addIntegrationToProject).toHaveBeenCalled();

    await tick();
    expect(wrapper.state('integrations')[0].projects).toEqual([project.slug]);

    wrapper.find('Switch').simulate('click');
    expect(removeIntegrationFromProject).toHaveBeenCalled();

    await tick();
    expect(wrapper.state('integrations')[0].projects).toEqual([]);
  });
});
