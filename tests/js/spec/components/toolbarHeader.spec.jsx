import React from 'react';
import {shallow} from 'enzyme';
import ToolbarHeader from 'app/components/toolbarHeader';

describe('ToolbarHeader', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<ToolbarHeader><div /></ToolbarHeader>);
    expect(wrapper).toMatchSnapshot();
  });
});
