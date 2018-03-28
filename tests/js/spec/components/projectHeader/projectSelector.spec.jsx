import React from 'react';
import {mount, shallow} from 'enzyme';

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
            name: 'Test Project',
          },
          {
            slug: 'another-project',
            name: 'Another Project',
          },
        ],
      },
    ],
    projects: [
      {
        slug: 'test-project',
        name: 'Test Project',
        isMember: true,
        team: {
          name: 'Test Team',
          slug: 'test-team',
          isMember: true,
          projects: [
            {
              slug: 'test-project',
              name: 'Test Project',
            },
            {
              slug: 'another-project',
              name: 'Another Project',
            },
          ],
        },
      },
      {
        slug: 'another-project',
        name: 'Another Project',
        isMember: true,
        team: {
          name: 'Test Team',
          slug: 'test-team',
          isMember: true,
          projects: [
            {
              slug: 'test-project',
              name: 'Test Project',
            },
            {
              slug: 'another-project',
              name: 'Another Project',
            },
          ],
        },
      },
    ],
    access: [],
  };

  describe('render()', function() {
    beforeEach(function() {
      jQuery(document).off('click');
    });

    it('should show empty message with no projects button, when no projects, and has no "project:write" access', function() {
      let wrapper = shallow(
        <ProjectSelector
          organization={{
            id: 'org',
            slug: 'org-slug',
            teams: [],
            projects: [],
            access: [],
          }}
          projectId=""
        />,
        {
          context: {router: TestStubs.router()},
        }
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('should show empty message and create project button, when no projects and has "project:write" access', function() {
      let wrapper = shallow(
        <ProjectSelector
          organization={{
            id: 'org',
            slug: 'org-slug',
            teams: [],
            projects: [],
            access: ['project:write'],
          }}
          projectId=""
        />,
        {
          context: {router: TestStubs.router()},
        }
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('lists projects and has filter', function() {
      let wrapper = shallow(<ProjectSelector organization={mockOrg} projectId="" />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('can filter projects by team name/project name', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
      wrapper.find('.dropdown-actor').simulate('click');

      const input = wrapper.find('.project-filter input');
      // Team name contains test
      input.value = 'TEST';
      input.simulate('change', {target: input});

      expect(wrapper).toMatchSnapshot();
    });

    it('can filter projects by project name', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
      wrapper.find('.dropdown-actor').simulate('click');

      const input = wrapper.find('.project-filter input');
      input.value = 'another';
      input.simulate('change', {target: input});

      expect(wrapper).toMatchSnapshot();
    });

    it('does not close dropdown when input is clicked', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
      wrapper.find('.dropdown-actor').simulate('click');

      const input = wrapper.find('.project-filter input');
      input.simulate('click', {target: input});

      expect(wrapper.find('.dropdown-menu')).toHaveLength(1);
    });

    it('closes dropdown when project is selected', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
      wrapper.find('.dropdown-actor').simulate('click');
      // Select first project
      wrapper
        .find('.dropdown-menu [role="presentation"] a')
        .first()
        .simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
    });

    it('shows empty filter message when filtering has no results', function() {
      let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
      wrapper.find('.dropdown-actor').simulate('click');

      const input = wrapper.find('.project-filter input');
      input.value = 'Foo';
      input.simulate('change', {target: input});

      expect(wrapper).toMatchSnapshot();
    });
  });
});
