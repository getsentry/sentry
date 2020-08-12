import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import NewProject from 'app/views/projectInstall/newProject';

describe('NewProjectPlatform', function() {
  beforeEach(function() {
    this.stubbedApiRequest = jest.spyOn(Client.prototype, 'request');
  });

  describe('render()', function() {
    it('should render', function() {
      const {routerContext} = initializeOrg();
      const wrapper = mountWithTheme(<NewProject />, routerContext);
      expect(wrapper).toSnapshot();
    });
  });
});
