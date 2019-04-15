import React from 'react';
import {mount} from 'enzyme';

import Configure from 'app/views/onboarding/configure';
import ProjectsStore from 'app/stores/projectsStore';

describe('Configure should render correctly', function() {
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
      url: '/projects/testOrg/project-slug/docs/',
      body: {
        dsn: 'https://9ed7cdc60:20e868d7b@sentry.io/300733',
        platforms: [
          {
            integrations: [
              {
                type: 'language',
                link: 'https://docs.getsentry.com/hosted/clients/csharp/',
                id: 'node',
                name: 'node',
              },
            ],
            name: 'js',
            id: 'javascript',
          },
        ],
        dsnPublic: 'https://9ed7cdc6581145bcb46044b77bd82aa0@sentry.io/300733',
      },
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
      const props = {
        ...baseProps,
      };
      props.params.platform = 'node';

      const wrapper = mount(
        <Configure {...props} />,
        TestStubs.routerContext([
          {
            organization: {
              id: '1337',
              slug: 'testOrg',
              projects: [
                {
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
                },
              ],
              teams: [
                {
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
                },
              ],
            },
          },
        ])
      );

      await tick();
      // Not sure exactly why but without a second tick, test is flakey and can cause false positives
      await tick();
      wrapper.update();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
