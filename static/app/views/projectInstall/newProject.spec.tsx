import {MOCK_RESP_VERBOSE} from 'sentry-fixture/ruleConditions';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import NewProject from 'sentry/views/projectInstall/newProject';

describe('NewProjectPlatform', function () {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/rule-conditions/`,
      body: MOCK_RESP_VERBOSE,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render', function () {
    const {routerContext} = initializeOrg();
    render(<NewProject />, {context: routerContext});
  });
});
