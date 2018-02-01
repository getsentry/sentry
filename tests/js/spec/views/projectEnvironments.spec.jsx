import React from 'react';
import PropTypes from 'prop-types';
import {mount} from 'enzyme';

import ProjectEnvironments from 'app/views/projectEnvironments';

import EnvironmentStore from 'app/stores/environmentStore';

describe('ProjectEnvironments', function() {
  let org;
  let project;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();
  });

  describe('render()', function() {
    it('renders empty message', function() {
      let wrapper = mount(
        <ProjectEnvironments params={{orgId: org.slug, projectId: project.slug}} />,
        {
          context: {
            router: TestStubs.router(),
          },
          childContextTypes: {
            router: PropTypes.object,
          },
        }
      );

      expect(wrapper).toMatchSnapshot();
    });

    it('renders environment list', function() {
      EnvironmentStore.loadInitialData([{id: 1, name: 'production'}]);
      let wrapper = mount(
        <ProjectEnvironments params={{orgId: org.slug, projectId: project.slug}} />,
        {
          context: {router: TestStubs.router()},
          childContextTypes: {
            router: PropTypes.object,
          },
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
