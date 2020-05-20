import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ReturnButton from 'app/views/settings/components/forms/returnButton';

describe('returnButton', function() {
  it('renders', function() {
    const wrapper = shallow(<ReturnButton />);
    expect(wrapper).toMatchSnapshot();
  });
});
