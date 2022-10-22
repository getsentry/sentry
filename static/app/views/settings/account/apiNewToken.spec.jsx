import {routerContext} from 'fixtures/js-stubs/routerContext';

import {render} from 'sentry-test/reactTestingLibrary';

import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', function () {
  it('renders', function () {
    const wrapper = render(<ApiNewToken params={{}} />, {
      context: routerContext(),
    });
    expect(wrapper.container).toSnapshot();
  });
});
