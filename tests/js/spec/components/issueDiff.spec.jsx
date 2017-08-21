import React from 'react';
import {shallow} from 'enzyme';
import IssueDiff from 'app/components/issueDiff';

describe('IssueDiff', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<IssueDiff />);
    expect(wrapper).toMatchSnapshot();
  });
});
