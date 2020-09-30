import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SpreadLayout from 'app/components/spreadLayout';

describe('SpreadLayout', function () {
  it('renders with one child', function () {
    const component = mountWithTheme(
      <SpreadLayout>
        <div>child</div>
      </SpreadLayout>
    );

    expect(component).toSnapshot();
  });

  it('renders with multiple children', function () {
    const component = mountWithTheme(
      <SpreadLayout>
        <div>child #1</div>
        <div>child #2</div>
      </SpreadLayout>
    );

    expect(component).toSnapshot();
  });
});
