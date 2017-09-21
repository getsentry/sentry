import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';
import SplitLayout from 'app/components/splitLayout';

describe('SplitLayout', function() {
  it('renders with one child', function() {
    let component = shallow(
      <SplitLayout>
        <div>child</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with multiple children', function() {
    let component = shallow(
      <SplitLayout>
        <div>child #1</div>
        <div>child #2</div>
        <div>child #3</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with responsive property', function() {
    let component = shallow(
      <SplitLayout responsive>
        <div>child #1</div>
        <div>child #2</div>
        <div>child #3</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with a separation width', function() {
    let component = shallow(
      <SplitLayout responsive splitWidth={5}>
        <div>child #1</div>
        <div>child #2</div>
        <div>child #3</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });
});
