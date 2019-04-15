import {browserHistory} from 'react-router';
import React from 'react';

import {shallow, mount} from 'enzyme';
import {ProjectInstallPlatform} from 'app/views/projectInstall/platform';

describe('ProjectInstallPlatform', function() {
  describe('render()', function() {
    const baseProps = {
      api: new MockApiClient(),
      organization: TestStubs.Organization(),
      project: TestStubs.Project(),
      location: {query: {}},
      platformData: {
        platforms: [
          {
            id: 'csharp',
            name: 'C#',
            integrations: [
              {
                id: 'csharp',
                type: 'language',
              },
            ],
          },
          {
            id: 'javascript',
            name: 'JavaScript',
            integrations: [
              {
                id: 'javascript-react',
                type: 'framework',
              },
            ],
          },
          {
            id: 'node',
            name: 'Node.js',
            integrations: [
              {
                id: 'node',
                type: 'language',
              },
              {
                id: 'node-connect',
                type: 'framework',
              },
            ],
          },
        ],
      },
    };

    it('should redirect to if no matching platform', function() {
      const props = {
        ...baseProps,
        params: {
          orgId: baseProps.organization.slug,
          projectId: baseProps.project.slug,
          platform: 'other',
        },
      };

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/docs/other/',
        body: {},
      });

      mount(<ProjectInstallPlatform {...props} />, {
        organization: {id: '1337'},
      });

      expect(browserHistory.push).toHaveBeenCalledTimes(1);
    });

    it('should render NotFound if no matching integration/platform', async function() {
      const props = {
        ...baseProps,
        params: {
          platform: 'lua',
        },
      };

      const wrapper = shallow(<ProjectInstallPlatform {...props} />, {
        disableLifeCycleMethods: false,
        organization: {id: '1337'},
      });

      await tick();
      wrapper.update();

      expect(wrapper.find('NotFound')).toHaveLength(1);
    });

    it('should rendering Loading if integration/platform exists', function() {
      const props = {
        ...baseProps,
        params: {
          platform: 'node-connect',
        },
      };

      const wrapper = shallow(<ProjectInstallPlatform {...props} />, {
        disableLifeCycleMethods: false,
        organization: {id: '1337'},
      });

      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    });
  });
});
