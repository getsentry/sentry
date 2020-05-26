import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ApiNewToken from 'app/views/settings/account/apiNewToken';

describe('ApiNewToken', function() {
  describe('render()', function() {
    it('renders', function() {
      const wrapper = shallow(<ApiNewToken params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
