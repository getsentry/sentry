import React from 'react';
import {shallow} from 'enzyme';
import SplitDiff from 'app/components/splitDiff';

describe('SplitDiff', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<SplitDiff base="restaurant" target="aura" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with newlines', function() {
    let base = `this is my restaurant
    and restaurant
    common`;
    let target = `aura
    and your aura
    common`;
    let wrapper = shallow(<SplitDiff base={base} target={target} />);
    expect(wrapper).toMatchSnapshot();
  });
});
