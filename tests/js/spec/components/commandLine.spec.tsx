import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import CommandLine from 'app/components/commandLine';

describe('CommandLine', () => {
  it('renders', () => {
    const children = 'sentry devserver --workers';
    const wrapper = mountWithTheme(<CommandLine>{children}</CommandLine>);
    expect(wrapper.find('CommandLine').text()).toBe(children);
  });
});
