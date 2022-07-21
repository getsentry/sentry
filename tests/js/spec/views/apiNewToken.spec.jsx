import {render} from 'sentry-test/reactTestingLibrary';

import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', function () {
  it('renders', function () {
    const wrapper = render(<ApiNewToken params={{}} />, {
      context: TestStubs.routerContext(),
    });
    expect(wrapper.container).toSnapshot();
  });
});
