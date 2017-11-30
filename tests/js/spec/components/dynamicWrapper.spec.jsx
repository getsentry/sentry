import React from 'react';
import {shallow} from 'enzyme';
import DynamicWrapper from 'app/components/dynamicWrapper';

describe('DynamicWrapper', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders actual value', function() {
    let wrapper = shallow(<DynamicWrapper fixed="Test" value="Dynamic Content" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders fixed content when `process.env.IS_PERCY` is true', function() {
    // eslint-disable-next-line no-undef
    process.env.IS_PERCY = true;
    let wrapper = shallow(<DynamicWrapper fixed="Test" value="Dynamic Content" />);
    expect(wrapper).toMatchSnapshot();
    // eslint-disable-next-line no-undef
    process.env.IS_PERCY = null;
  });
});
