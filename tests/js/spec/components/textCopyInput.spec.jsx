import React from 'react';
import {shallow} from 'enzyme';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

describe('TextCopyInput', function() {
  it('renders', function() {
    let wrapper = shallow(<TextCopyInput>Text to Copy</TextCopyInput>);
    expect(wrapper).toMatchSnapshot();
  });
});
