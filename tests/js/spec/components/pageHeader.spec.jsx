import React from 'react';
import {shallow} from 'enzyme';
import PageHeading from 'app/components/pageHeading';

describe('PageHeading', function() {
  it('renders', function() {
    let wrapper = shallow(<PageHeading>New Header</PageHeading>);
    expect(wrapper).toMatchSnapshot();
  });
});
