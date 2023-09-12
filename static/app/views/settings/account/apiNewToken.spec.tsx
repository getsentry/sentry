import {render} from 'sentry-test/reactTestingLibrary';

import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', function () {
  it('renders', function () {
    render(<ApiNewToken />, {
      context: TestStubs.routerContext(),
    });
  });
});
