/* eslint-disable jest/no-disabled-tests */

import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import PluginIcon from 'app/plugins/components/pluginIcon';

// For some reason jest only respects the last mocked, so we can't test
// two different images here
// jest.mock('images/logos/logo-default.svg', () => 'default', {});
jest.mock('images/logos/logo-github.svg', () => 'github', {});

describe('PluginIcon', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(<PluginIcon pluginId="github" size={20} />);
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  // doesn't work because of the above comment
  it.skip('renders with default icon with invalid plugin id', function() {
    const wrapper = mountWithTheme(<PluginIcon pluginId="invalid" size={20} />);
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });
});
