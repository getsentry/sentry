import React from 'react';
import {shallow} from 'enzyme';
import SplitDiff from 'app/components/splitDiff';

describe('SplitDiff', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', function() {
    const wrapper = shallow(<SplitDiff base="restaurant" target="aura" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with newlines', function() {
    const base = `this is my restaurant
    and restaurant
    common`;
    const target = `aura
    and your aura
    common`;
    const wrapper = shallow(<SplitDiff base={base} target={target} />);
    expect(wrapper).toMatchSnapshot();
  });
});
