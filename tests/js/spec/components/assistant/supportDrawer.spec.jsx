import React from 'react';
import {shallow} from 'enzyme';
import SupportDrawer from 'app/components/assistant/supportDrawer';

describe('SupportDrawer', function() {
  it('renders', function() {
    let wrapper = shallow(<SupportDrawer onClose={() => {}} />);
    expect(wrapper).toMatchSnapshot();
  });
});
