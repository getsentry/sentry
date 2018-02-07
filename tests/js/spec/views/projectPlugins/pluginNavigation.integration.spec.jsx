import React from 'react';
import PropTypes from 'prop-types';
import {mount} from 'enzyme';
import ProjectPlugins from 'app/views/projectPlugins';
import PluginNavigation from 'app/views/projectSettings/pluginNavigation';

jest.mock('app/api');

describe('PluginNavigation Integration', function() {
  let org, project, plugins, wrapper;
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    org = TestStubs.Organization();
    project = TestStubs.Project();
    plugins = TestStubs.Plugins();

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

  afterEach(function() {
    sandbox.restore();
  });

  // Integration test with PluginNavigation
  describe('with PluginNavigation', function() {
    beforeEach(async function() {
      let params = {orgId: org.slug, projectId: project.slug};

      wrapper = mount(
        <div>
          <ProjectPlugins params={params} />
          <PluginNavigation urlRoot="/" />
        </div>,
        {
          context: {
            router: TestStubs.router(),
          },
          childContextTypes: {
            router: PropTypes.object,
          },
        }
      );
    });

    it('has no items in <PluginNavigation />', function() {
      expect(wrapper.find('PluginNavigation a')).toHaveLength(0);
    });

    /**
     * This tests that ProjectPlugins and PluginNavigation respond to the same store
     */
    it('has Amazon in <PluginNavigation /> after enabling', function(done) {
      let hasEnabled = false;
      let originalDidUpdate =
        ProjectPlugins.prototype.componentDidUpdate || function() {};

      // Yuck, not sure of a better way to test these
      ProjectPlugins.prototype.componentDidUpdate = function() {
        wrapper.update();
        if (!hasEnabled && wrapper.find('Checkbox').length) {
          hasEnabled = true;
          // Enable first plugin, should be amazon
          wrapper
            .find('Checkbox')
            .first()
            .simulate('change');

          wrapper.update();
        }
        originalDidUpdate();
      };

      PluginNavigation.prototype.componentDidUpdate = function() {
        wrapper.update();
        if (wrapper.find('PluginNavigation a').length) {
          expect(wrapper.find('PluginNavigation').find('a')).toHaveLength(1);
          done();
        }
        originalDidUpdate();
      };
    });
  });
});
