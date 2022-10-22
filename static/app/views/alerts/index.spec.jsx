import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {routerContext} from 'fixtures/js-stubs/routerContext';

import {render} from 'sentry-test/reactTestingLibrary';

import AlertsContainer from 'sentry/views/alerts';

describe('AlertsContainer', function () {
  describe('no access without feature flag', function () {
    it('display no access message', function () {
      const organization = Organization({projects: [Project()]});
      const {container} = render(<AlertsContainer />, {
        context: routerContext([{organization}]),
        organization,
      });
      expect(container).toBeEmptyDOMElement();
    });
  });
});
