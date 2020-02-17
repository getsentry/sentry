import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import CongratsRobots from 'app/views/issueList/congratsRobots';

describe('CongratsRobots', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(<CongratsRobots />);

    expect(wrapper.find('AnimatedScene').exists()).toBe(true);
    expect(wrapper.find('StyledVideo').exists()).toBe(true);
  });
});
