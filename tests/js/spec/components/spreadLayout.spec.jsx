import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';
import SpreadLayout from 'app/components/spreadLayout';

describe('SpreadLayout', function() {
  it('renders with one child', function() {
    let component = shallow(
      <SpreadLayout>
        <div>child</div>
      </SpreadLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with multiple children', function() {
    let component = shallow(
      <SpreadLayout>
        <div>child #1</div>
        <div>child #2</div>
      </SpreadLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });
});
