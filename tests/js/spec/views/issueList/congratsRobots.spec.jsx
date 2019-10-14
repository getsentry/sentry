import React from 'react';
import {mount} from 'sentry-test/enzyme';

import CongratsRobots from 'app/views/issueList/congratsRobots';

describe('CongratsRobots', function() {
  it('renders', function() {
    const wrapper = mount(<CongratsRobots />);

    expect(wrapper.find('Lottie').exists()).toBe(true);
    expect(wrapper.find('Description').exists()).toBe(true);
  });
});
