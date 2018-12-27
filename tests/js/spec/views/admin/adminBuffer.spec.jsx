import React from 'react';
import {shallow} from 'enzyme';

import AdminBuffer from 'app/views/admin/adminBuffer';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminBuffer', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<AdminBuffer params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
