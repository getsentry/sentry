import React from 'react';
import {shallow} from 'enzyme';
import DiffModal from 'app/components/modals/diffModal';

describe('DiffModal', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<DiffModal Body={({children}) => <div>{children}</div>} />);
    expect(wrapper).toMatchSnapshot();
  });
});
