import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ToolbarHeader from 'app/components/toolbarHeader';

describe('ToolbarHeader', function() {
  beforeEach(function() {});

  afterEach(function() {});

  it('renders', function() {
    const wrapper = shallow(
      <ToolbarHeader>
        <div />
      </ToolbarHeader>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
