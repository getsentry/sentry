import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import AdminSettings from 'app/views/adminSettings';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminSettings', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<AdminSettings params={{}} />, {
        context: {
          router: TestStubs.router()
        }
      });
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
