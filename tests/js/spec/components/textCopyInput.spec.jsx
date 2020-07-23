import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

describe('TextCopyInput', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(<TextCopyInput>Text to Copy</TextCopyInput>);
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });
});
