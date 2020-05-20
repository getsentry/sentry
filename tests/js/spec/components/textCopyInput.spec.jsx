import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

describe('TextCopyInput', function() {
  it('renders', function() {
    const wrapper = shallow(<TextCopyInput>Text to Copy</TextCopyInput>);
    expect(wrapper).toMatchSnapshot();
  });
});
