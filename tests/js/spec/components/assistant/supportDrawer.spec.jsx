import React from 'react';
import {shallow, mount} from 'enzyme';
import SupportDrawer from 'app/components/assistant/supportDrawer';

describe('SupportDrawer', function() {
  it('renders cue', function() {
    let wrapper = shallow(<SupportDrawer />, TestStubs.routerContext());
    expect(wrapper).toMatchSnapshot();
  });

  it('renders drawer', async function() {
    let wrapper = mount(<SupportDrawer />, TestStubs.routerContext());
    wrapper
      .find('.assistant-cue')
      .first()
      .simulate('click');
    await tick();
    wrapper.update();
    expect(wrapper.find('SupportContainer')).toHaveLength(1);
  });
});
