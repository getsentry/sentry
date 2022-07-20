import {render} from 'sentry-test/reactTestingLibrary';

import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = render(<ApiNewToken params={{}} />, {
        context: {
          context: {
            router: TestStubs.router(),
          },
        },
      });
      expect(wrapper.container).toSnapshot();
    });
  });
});
