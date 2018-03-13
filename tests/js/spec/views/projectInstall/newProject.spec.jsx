import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import NewProject from 'app/views/projectInstall/newProject';

describe('NewProjectPlatform', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    this.stubbedApiRequest = sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    it('should render', function() {
      let wrapper = shallow(<NewProject />, {
        context: {
          organization: {
            id: '1337',
            slug: 'testOrg',
            teams: [['testProject']],
          },
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
