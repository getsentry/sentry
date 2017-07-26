import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';
import Checkbox from 'app/components/checkbox';

describe('Checkbox', function() {
  it('renders', function() {
    let component = shallow(<Checkbox />);

    expect(toJson(component)).toMatchSnapshot();
  });
});
