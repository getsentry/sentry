import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ReturnButton from 'app/views/settings/components/forms/returnButton';

describe('returnButton', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(<ReturnButton />);
    expect(wrapper).toSnapshot();
  });
});
