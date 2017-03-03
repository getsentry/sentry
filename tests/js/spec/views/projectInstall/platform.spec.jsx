import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';

describe('ProjectInstallPlatform', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      location: {query: {}},
      platformData: {
        platforms: [{
          id: 'csharp',
          name: 'C#',
          integrations: [{
            id: 'csharp',
            type: 'language'
          }]
        }, {
          id: 'node',
          name: 'Node.js',
          integrations: [{
            id: 'node',
            type: 'language'
          }, {
            id: 'node-connect',
            type: 'framework'
          }]
        }]
      }
    };

    it('should render NotFound if no matching integration/platform', function () {
      let props = {
        ...baseProps,
        params: {
          platform: 'lua'
        }
      };

      let wrapper = shallow(<ProjectInstallPlatform {...props}/>, {
        organization: {id: '1337'}
      });

      expect(wrapper.find('NotFound')).to.have.length(1);
    });

    it('should rendering Loading if integration/platform exists', function () {
      let props = {
        ...baseProps,
        params: {
          platform: 'node-connect'
        }
      };

      let wrapper = shallow(<ProjectInstallPlatform {...props}/>, {
        organization: {id: '1337'}
      });

      expect(wrapper.find('LoadingIndicator')).to.have.length(1);
    });
  });
});
