import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ToolbarHeader from 'app/components/toolbarHeader';

describe('ToolbarHeader', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const wrapper = mountWithTheme(
      <ToolbarHeader>
        <div />
      </ToolbarHeader>
    );
    expect(wrapper).toSnapshot();
  });
});
