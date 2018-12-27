import React from 'react';
import {shallow} from 'enzyme';
import CircleIndicator from 'app/components/circleIndicator';

describe('CircleIndicator', function() {
  it('renders', function() {
    let wrapper = shallow(<CircleIndicator />);
    expect(wrapper).toMatchSnapshot();
  });
});
