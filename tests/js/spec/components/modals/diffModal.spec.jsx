import React from 'react';
import {shallow} from 'enzyme';
import DiffModal from 'app/components/modals/diffModal';

describe('DiffModal', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<DiffModal />);
    expect(wrapper).toMatchSnapshot();
  });
});
