import React from 'react';
import {shallow} from 'enzyme';
import DynamicWrapper from 'app/components/dynamicWrapper';

describe('DynamicWrapper', function() {
  beforeEach(function() {});

  afterEach(function() {});

  it('renders actual value', function() {
    const wrapper = shallow(<DynamicWrapper fixed="Test" value="Dynamic Content" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders fixed content when `process.env.IS_PERCY` is true', function() {
    // eslint-disable-next-line no-undef
    process.env.IS_PERCY = true;
    const wrapper = shallow(<DynamicWrapper fixed="Test" value="Dynamic Content" />);
    expect(wrapper).toMatchSnapshot();
    // eslint-disable-next-line no-undef
    process.env.IS_PERCY = null;
  });
});
