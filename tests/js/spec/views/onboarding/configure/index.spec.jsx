import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import Configure from 'app/views/onboarding/configure';
import ProjectsStore from 'app/stores/projectsStore';

describe('Configure should render correctly', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    Client.addMockResponse({
      url: '/projects/testOrg/project-slug/',
      body: TestStubs.Project(),
    });
    Client.addMockResponse({
      url: '/projects/testOrg/project-slug/events/',
      body: {},
    });
    Client.addMockResponse({
      url: '/projects/testOrg/project-slug/members/',
      body: [],
    });
    Client.addMockResponse({
      url: '/projects/testOrg/project-slug/environments/',
      body: {},
    });
    Client.addMockResponse({
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
    Client.addMockResponse({
      url: '/projects/testOrg/project-slug/docs/node/',
      body: {},
    });

    ProjectsStore.loadInitialData([
      {
        name: 'Test Project',
        slug: 'project-slug',
        id: 'testProject',
        hasAccess: true,
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
    sandbox.restore();
    ProjectsStore.loadInitialData([]);
  });

  describe('render()', function() {
    const baseProps = {
      next: () => {},
      params: {
        projectId: 'project-slug',
        orgId: 'testOrg',
      },
    };

    it("shouldn't redirect for a found platform", function() {
      let props = {
        ...baseProps,
      };
      props.params.platform = 'node';

      let wrapper = shallow(
        <Configure {...props} />,
        TestStubs.routerContext([
          {
            organization: {id: '1337', slug: 'testOrg', teams: [['project-slug']]},
          },
        ])
      );

      const component = wrapper.instance();

      let handleSubmitStub = sandbox.stub(component, 'redirectToNeutralDocs', () => {});

      wrapper.update();
      expect(wrapper).toMatchSnapshot();
      expect(handleSubmitStub.callCount).toEqual(0);
    });

    it('should redirect to if no matching platform', function() {
      let props = {
        ...baseProps,
      };
      props.params.platform = 'other';

      let handleSubmitStub = sandbox.stub(Configure.prototype, 'redirectToNeutralDocs');

      // 👺 ⚠️ this is a hack to defeat the method auto binding so we can fully stub the method. It would not be neccessary with es6 class components and it relies on react internals so it's fragile - maxbittker
      const index =
        Configure.prototype.__reactAutoBindPairs.indexOf('redirectToNeutralDocs') + 1;
      Configure.prototype.__reactAutoBindPairs[index] = handleSubmitStub;

      let wrapper = shallow(
        <Configure {...props} />,
        TestStubs.routerContext([
          {
            organization: {id: '1337', slug: 'testOrg', teams: [['project-slug']]},
          },
        ])
      );

      expect(wrapper).toMatchSnapshot();
      expect(handleSubmitStub.callCount).toEqual(1);
    });

    it('should render platform docs', function(done) {
      let props = {
        ...baseProps,
      };
      props.params.platform = 'node';

      let wrapper = mount(
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

      setTimeout(() => {
        wrapper.update();
        expect(wrapper).toMatchSnapshot();
        done();
      });
    });
  });
});
