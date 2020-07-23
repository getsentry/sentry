import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ApiNewToken from 'app/views/settings/account/apiNewToken';

describe('ApiNewToken', function() {
  describe('render()', function() {
    it('renders', function() {
      const wrapper = mountWithTheme(<ApiNewToken params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toSnapshot();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
