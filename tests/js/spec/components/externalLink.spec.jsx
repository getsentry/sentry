import React from 'react';
import {shallow} from 'enzyme';
import ExternalLink from 'app/components/externalLink';

describe('ExternalLink', function() {
  it('renders', function() {
    let wrapper = shallow(<ExternalLink href="https://www.sentry.io/" />);
    expect(wrapper).toMatchSnapshot();
  });
});
