import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import Qrcode from 'app/components/qrcode';

describe('Qrcode', function() {
  it('renders', function() {
    const wrapper = shallow(<Qrcode code={[[0, 1, 1, 0, 0, 0, 0, 0]]} />);
    expect(wrapper).toMatchSnapshot();
  });
});
