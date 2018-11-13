import React from 'react';
import {shallow} from 'enzyme';

import ProjectChooser from 'app/views/projectChooser';

describe('ProjectChooser', function() {
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

  it('renders', function() {
    let wrapper = shallow(
      <ProjectChooser
        location={{
          pathname: 'https://sentry.io/organizations/tester1/projects/choose/',
          query: {onboarding: '1', task: '2'},
          search: '?onboarding=1&task=2',
        }}
      />,
      {
        context: {
          organization: mockOrg,
        },
      }
    );
    expect(wrapper).toMatchSnapshot();
  });
});
