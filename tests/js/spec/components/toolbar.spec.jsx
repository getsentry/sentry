import React from 'react';
import {shallow} from 'enzyme';
import Toolbar from 'app/components/toolbar';

describe('Toolbar', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(
      <Toolbar>
        <div />
      </Toolbar>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
