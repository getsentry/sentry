import React from 'react';
import {shallow} from 'enzyme';
import ToolbarHeader from 'app/components/toolbarHeader';

describe('ToolbarHeader', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(
      <ToolbarHeader>
        <div />
      </ToolbarHeader>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
