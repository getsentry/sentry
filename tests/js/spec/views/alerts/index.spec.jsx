import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IncidentsContainer from 'app/views/alerts';

describe('IncidentsContainer', function() {
  describe('no access without feature flag', function() {
    it('display no access message', function() {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      const wrapper = mountWithTheme(
        <IncidentsContainer />,
        TestStubs.routerContext([{organization}])
      );
      expect(wrapper.text()).toBe("You don't have access to this feature");
    });
  });
});
