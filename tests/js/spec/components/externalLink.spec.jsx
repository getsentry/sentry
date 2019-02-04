import React from 'react';
import {shallow} from 'enzyme';
import ExternalLink from 'app/components/externalLink';

describe('ExternalLink', function() {
  it('renders', function() {
    const wrapper = shallow(<ExternalLink href="https://www.sentry.io/" />);
    expect(wrapper).toMatchSnapshot();
  });
});
