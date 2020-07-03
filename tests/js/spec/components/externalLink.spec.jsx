import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ExternalLink from 'app/components/links/externalLink';

describe('ExternalLink', function() {
  it('renders', function() {
    const wrapper = shallow(<ExternalLink href="https://www.sentry.io/" />);
    expect(wrapper).toMatchSnapshot();
  });
});
