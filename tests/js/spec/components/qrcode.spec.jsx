import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Qrcode from 'app/components/qrcode';

describe('Qrcode', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(<Qrcode code={[[0, 1, 1, 0, 0, 0, 0, 0]]} />);
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });
});
