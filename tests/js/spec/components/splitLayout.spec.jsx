import React from 'react';
import {shallow} from 'sentry-test/enzyme';
import toJson from 'enzyme-to-json';
import SplitLayout from 'app/components/splitLayout';

describe('SplitLayout', function() {
  it('renders with one child', function() {
    const component = shallow(
      <SplitLayout>
        <div>child</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with multiple children', function() {
    const component = shallow(
      <SplitLayout>
        <div>child #1</div>
        <div>child #2</div>
        <div>child #3</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with responsive property', function() {
    const component = shallow(
      <SplitLayout responsive>
        <div>child #1</div>
        <div>child #2</div>
        <div>child #3</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with a separation width', function() {
    const component = shallow(
      <SplitLayout responsive splitWidth={5}>
        <div>child #1</div>
        <div>child #2</div>
        <div>child #3</div>
      </SplitLayout>
    );

    expect(toJson(component)).toMatchSnapshot();
  });
});
