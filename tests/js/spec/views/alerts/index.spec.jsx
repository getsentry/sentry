import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import AlertsContainer from 'sentry/views/alerts';

describe('AlertsContainer', function () {
  describe('no access without feature flag', function () {
    it('display no access message', function () {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      const {container} = mountWithTheme(<AlertsContainer />, {
        context: TestStubs.routerContext([{organization}]),
        organization,
      });
      expect(container).toBeEmptyDOMElement();
    });
  });
});
