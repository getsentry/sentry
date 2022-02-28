import {enzymeRender} from 'sentry-test/enzyme';

import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = enzymeRender(<ApiNewToken params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toSnapshot();
    });
  });
});
