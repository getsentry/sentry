import React from 'react';
import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import Button from 'app/components/button';

describe('Button', function() {
  const routerContext = TestStubs.routerContext();

  it('renders', function() {
    const component = shallow(
      <Button priority="primary" size="large">
        Button
      </Button>
    );
    expect(component).toMatchSnapshot();
  });

  it('renders react-router link', function() {
    const component = shallow(
      <Button to="/some/route">Router Link</Button>,
      routerContext
    );
    expect(component).toMatchSnapshot();
  });

  it('renders normal link', function() {
    const component = shallow(
      <Button href="/some/relative/url">Normal Link</Button>,
      routerContext
    );
    expect(component).toMatchSnapshot();
  });

  it('renders disabled normal link', function() {
    const component = shallow(
      <Button href="/some/relative/url">Normal Link</Button>,
      routerContext
    );
    expect(component).toMatchSnapshot();
  });

  it('calls `onClick` callback', function() {
    const spy = jest.fn();
    const component = mountWithTheme(<Button onClick={spy} />, routerContext);
    component.simulate('click');

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', function() {
    const spy = jest.fn();
    const component = mountWithTheme(<Button onClick={spy} disabled />, routerContext);
    component.simulate('click');

    expect(spy).not.toHaveBeenCalled();
  });
});
