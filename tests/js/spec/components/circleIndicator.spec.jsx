import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import CircleIndicator from 'app/components/circleIndicator';

describe('CircleIndicator', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(<CircleIndicator />);
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });
});
