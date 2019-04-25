import React from 'react';
import {mount} from 'enzyme';

import Configure from 'app/views/onboarding/configure';
import ProjectsStore from 'app/stores/projectsStore';

describe('Configure should render correctly', function() {
  let organization, project, team;

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/projects/testOrg/project-slug/',
      body: TestStubs.Project(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/testOrg/project-slug/events/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/testOrg/project-slug/environments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/testOrg/project-slug/docs/node/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/projects/testOrg/project-slug/docs/other/',
      body: {},
    });
    ProjectsStore.loadInitialData([
      {
        name: 'Test Project',
        slug: 'project-slug',
        id: 'testProject',
        hasAccess: true,
        isMember: true,
        isBookmarked: false,
        teams: [
          {
            slug: 'coolteam',
            id: 'coolid',
            hasAccess: true,
          },
        ],
      },
    ]);

    project = {
      name: 'Test Project',
      slug: 'project-slug',
      id: 'testProject',
      hasAccess: true,
      isBookmarked: false,
      isMember: true,
      teams: [
        {
          id: 'coolteam',
          slug: 'coolteam',
          hasAccess: true,
        },
      ],
    };

    team = {
      id: 'coolteam',
      slug: 'coolteam',
      hasAccess: true,
      projects: [
        {
          name: 'Test Project',
          slug: 'project-slug',
          id: 'testProject',
        },
      ],
    };

    organization = {
      id: '1337',
      slug: 'testOrg',
      projects: [project],
      teams: [team],
    };
  });

  afterEach(function() {
    ProjectsStore.loadInitialData([]);
  });

  afterAll(function() {
    MockApiClient.clearMockResponses();
  });

  describe('render()', function() {
    const baseProps = {
      api: new MockApiClient(),
      next: () => {},
      params: {
        projectId: 'project-slug',
        orgId: 'testOrg',
      },
    };

    it('should render platform docs', async function() {
      const props = {...baseProps};
      props.params.platform = 'node';

      const wrapper = mount(
        <Configure {...props} />,
        TestStubs.routerContext([{organization}])
      );

      await tick();
      wrapper.update();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
