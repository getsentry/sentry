import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';

describe('ProjectInstallPlatform', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
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

    it('should render NotFound if no matching integration/platform', function() {
      let props = {
        ...baseProps,
        params: {
          platform: 'lua',
        },
      };

      let wrapper = shallow(<ProjectInstallPlatform {...props} />, {
        organization: {id: '1337'},
      });

      expect(wrapper.find('NotFound')).toHaveLength(1);
    });

    it('should rendering Loading if integration/platform exists', function() {
      let props = {
        ...baseProps,
        params: {
          platform: 'node-connect',
        },
      };

      let wrapper = shallow(<ProjectInstallPlatform {...props} />, {
        organization: {id: '1337'},
      });

      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    });

    // TO-DO(Dena): Remove next three tests after experiment
    it('should render experiment if selected react and in treatment', function() {
      // Assignment in treatment or control lives in the configstore
      ConfigStore.set('features', new Set(['install-experiment']));
      let props = {
        ...baseProps,
        params: {
          platform: 'javascript-react',
        },
      };
      let wrapper = shallow(<ProjectInstallPlatform {...props} />, {
        disableLifecycleMethods: false,
        organization: {id: '1337'},
      });

      wrapper.setState({loading: false});
      expect(wrapper.find('InstallReactTest')).toHaveLength(1);
    });

    it('should not render experiment if selected react and in control', function() {
      // Assignment in treatment or control lives in the configstore
      ConfigStore.set('features', new Set());
      let props = {
        ...baseProps,
        params: {
          platform: 'javascript-react',
        },
      };
      let wrapper = shallow(<ProjectInstallPlatform {...props} />, {
        disableLifecycleMethods: false,
        organization: {id: '1337'},
      });

      wrapper.setState({loading: false});
      expect(wrapper.find('InstallReactTest')).toHaveLength(0);
    });

    it('should not render experiment if did not select react and in treatment', function() {
      // Assignment in treatment or control lives in the configstore
      ConfigStore.set('features', new Set(['install-experiment']));
      let props = {
        ...baseProps,
        params: {
          platform: 'node-connect',
        },
      };
      let wrapper = shallow(<ProjectInstallPlatform {...props} />, {
        disableLifecycleMethods: false,
        organization: {id: '1337'},
      });

      wrapper.setState({loading: false});
      expect(wrapper.find('InstallReactTest')).toHaveLength(0);
    });
  });
});
