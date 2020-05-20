import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import PageHeading from 'app/components/pageHeading';

describe('PageHeading', function() {
  it('renders', function() {
    const wrapper = shallow(<PageHeading>New Header</PageHeading>);
    expect(wrapper).toMatchSnapshot();
  });
});
