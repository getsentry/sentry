import React from 'react';
import toJson from 'enzyme-to-json';

import {shallow} from 'sentry-test/enzyme';

import Checkbox from 'app/components/checkbox';

describe('Checkbox', function() {
  it('renders', function() {
    const component = shallow(<Checkbox />);

    expect(toJson(component)).toMatchSnapshot();
  });
});
