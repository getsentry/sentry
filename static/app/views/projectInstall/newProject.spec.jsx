import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import NewProject from 'sentry/views/projectInstall/newProject';

describe('NewProjectPlatform', function () {
  it('should render', function () {
    const {routerContext} = initializeOrg();
    const wrapper = render(<NewProject />, {context: routerContext});
    expect(wrapper.container).toSnapshot();
  });
});
