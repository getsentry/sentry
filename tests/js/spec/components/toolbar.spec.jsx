import React from 'react';
import {shallow} from 'enzyme';
import Toolbar from 'app/components/toolbar';

describe('Toolbar', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<Toolbar><div /></Toolbar>);
    expect(wrapper).toMatchSnapshot();
  });
});
