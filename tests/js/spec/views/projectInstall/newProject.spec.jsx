import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import NewProject from 'app/views/projectInstall/newProject';

describe('NewProjectPlatform', function() {
  beforeEach(function() {
    this.stubbedApiRequest = jest.spyOn(Client.prototype, 'request');
  });

  afterEach(function() {});

  describe('render()', function() {
    it('should render', function() {
      const wrapper = shallow(<NewProject />, {
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
