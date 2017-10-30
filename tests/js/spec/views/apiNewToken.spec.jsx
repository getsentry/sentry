import React from 'react';
import {shallow} from 'enzyme';

import ApiNewToken from 'app/views/apiNewToken';

describe('ApiNewToken', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<ApiNewToken params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
