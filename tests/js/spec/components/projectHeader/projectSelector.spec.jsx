import React from 'react';
import {mount, shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import ProjectSelector from 'app/components/projectHeader/projectSelector';

describe('ProjectSelector', function() {
  const mockOrg = {
    id: 'org',
    slug: 'org',
    teams: [
      {
        name: 'Test Team',
        slug: 'test-team',
        isMember: true,
        projects: [
          {
            slug: 'test-project',
            name: 'Test Project'
          },
          {
            slug: 'another-project',
            name: 'Another Project'
          }
        ]
      }
    ],
    access: []
  };
  describe('render()', function() {
    it('should show empty message with no projects button, when no projects, and has no "project:write" access', function() {
      let wrapper = shallow(
        <ProjectSelector
          organization={{
            id: 'org',
            slug: 'org-slug',
            teams: [],
            access: []
          }}
          projectId=""
        />,
        {
          context: {router: TestStubs.router()}
        }
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('should show empty message and create project button, when no projects and has "project:write" access', function() {
      let wrapper = shallow(
        <ProjectSelector
          organization={{
            id: 'org',
            slug: 'org-slug',
            teams: [],
            access: ['project:write']
          }}
          projectId=""
        />,
        {
          context: {router: TestStubs.router()}
        }
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('lists projects and has filter', function() {
      let wrapper = shallow(<ProjectSelector organization={mockOrg} projectId="" />, {
        context: {router: TestStubs.router()}
      });
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('can filter projects by team name/project name', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});

      const input = wrapper.find('.project-filter input');
      // Team name contains test
      input.value = 'TEST';
      input.simulate('change', {target: input});

      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('can filter projects by project name', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});

      const input = wrapper.find('.project-filter input');
      input.value = 'another';
      input.simulate('change', {target: input});

      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('shows empty filter message when filtering has no results', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});

      const input = wrapper.find('.project-filter input');
      input.value = 'Foo';
      input.simulate('change', {target: input});

      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
