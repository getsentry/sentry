import React from 'react';
import toJson from 'enzyme-to-json';

import {shallow} from 'sentry-test/enzyme';

import SpreadLayout from 'app/components/spreadLayout';

describe('SpreadLayout', function() {
  it('renders with one child', function() {
    const component = shallow(
      <SpreadLayout>
        <div>child</div>
      </SpreadLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with multiple children', function() {
    const component = shallow(
      <SpreadLayout>
        <div>child #1</div>
        <div>child #2</div>
      </SpreadLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });
});
