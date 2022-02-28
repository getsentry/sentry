import {enzymeRender} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'sentry/api';
import NewProject from 'sentry/views/projectInstall/newProject';

describe('NewProjectPlatform', function () {
  beforeEach(function () {
    this.stubbedApiRequest = jest.spyOn(Client.prototype, 'request');
  });

  describe('render()', function () {
    it('should render', function () {
      const {routerContext} = initializeOrg();
      const wrapper = enzymeRender(<NewProject />, routerContext);
      expect(wrapper).toSnapshot();
    });
  });
});
