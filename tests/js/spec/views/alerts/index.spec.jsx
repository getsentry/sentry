import {mountWithTheme} from 'sentry-test/enzyme';

import AlertsContainer from 'app/views/alerts';

describe('AlertsContainer', function () {
  describe('no access without feature flag', function () {
    it('display no access message', function () {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      const wrapper = mountWithTheme(
        <AlertsContainer />,
        TestStubs.routerContext([{organization}])
      );
      expect(wrapper.text()).toBe('');
    });
  });
});
