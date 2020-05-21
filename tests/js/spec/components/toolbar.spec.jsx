import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import Toolbar from 'app/components/toolbar';

describe('Toolbar', function() {
  beforeEach(function() {});

  afterEach(function() {});

  it('renders', function() {
    const wrapper = shallow(
      <Toolbar>
        <div />
      </Toolbar>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
