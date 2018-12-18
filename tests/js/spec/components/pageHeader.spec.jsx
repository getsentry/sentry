import React from 'react';
import {shallow} from 'enzyme';
import PageHeader from 'app/components/pageHeader';

describe('PageHeader', function() {
  it('renders', function() {
    let wrapper = shallow(<PageHeader>New Header</PageHeader>);
    expect(wrapper).toMatchSnapshot();
  });
});
