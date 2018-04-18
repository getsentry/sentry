import React from 'react';
import {shallow} from 'enzyme';

import ProjectList from 'app/views/organizationDashboard/projectList';

describe('ProjectList', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(
        <ProjectList projects={[TestStubs.Project({isMember: true})]} />,
        {
          context: {
            router: TestStubs.router(),
            organization: TestStubs.Organization(),
          },
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
