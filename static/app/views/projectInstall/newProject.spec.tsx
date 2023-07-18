import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import NewProject from 'sentry/views/projectInstall/newProject';

describe('NewProjectPlatform', function () {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/rule-conditions/`,
      body: TestStubs.MOCK_RESP_VERBOSE,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render', function () {
    const {routerContext} = initializeOrg();
    const wrapper = render(<NewProject />, {context: routerContext});
    expect(wrapper.container).toSnapshot();
  });
});
