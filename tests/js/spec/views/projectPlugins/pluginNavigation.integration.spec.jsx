import React from 'react';
import {mount} from 'enzyme';
import ProjectPlugins from 'app/views/projectPlugins';
import PluginNavigation from 'app/views/projectSettings/pluginNavigation';

jest.mock('app/api');

describe('PluginNavigation Integration', function() {
  let wrapper;
  let routerContext = TestStubs.routerContext();
  let org = routerContext.context.organization;
  let project = routerContext.context.project;
  let plugins = TestStubs.Plugins();

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      method: 'GET',
      body: {providers: [TestStubs.GitHubIntegrationProvider()]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
      method: 'GET',
      body: {organization: org},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: plugins,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/amazon-sqs/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/github/`,
      method: 'DELETE',
    });
  });

  // Integration test with PluginNavigation
  describe('with PluginNavigation', function() {
    beforeEach(function() {
      let params = {orgId: org.slug, projectId: project.slug};
      let organization = {...org, id: org.slug, features: []};
      wrapper = mount(
        <div>
          <ProjectPlugins params={params} organization={organization} />
          <PluginNavigation organization={organization} urlRoot="/" />
        </div>,
        TestStubs.routerContext()
      );
    });

    it('has no items in <PluginNavigation />', function() {
      expect(wrapper.find('PluginNavigation a')).toHaveLength(0);
    });

    /**
     * This tests that ProjectPlugins and PluginNavigation respond to the same store
     */
    it('has Amazon in <PluginNavigation /> after enabling', async function() {
      await tick();
      wrapper.update();
      wrapper
        .find('Switch')
        .first()
        .simulate('click');

      await tick();
      wrapper.update();
      expect(wrapper.find('PluginNavigation').find('a')).toHaveLength(1);
    });
  });
});
