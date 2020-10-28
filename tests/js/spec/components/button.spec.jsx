import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Button from 'app/components/button';

describe('Button', function () {
  const routerContext = TestStubs.routerContext();

  it('renders', function () {
    const component = mountWithTheme(<Button priority="primary">Button</Button>);
    expect(component).toSnapshot();
  });

  it('renders react-router link', function () {
    const component = mountWithTheme(
      <Button to="/some/route">Router Link</Button>,
      routerContext
    );
    expect(component).toSnapshot();
  });

  it('renders normal link', function () {
    const component = mountWithTheme(
      <Button href="/some/relative/url">Normal Link</Button>,
      routerContext
    );
    expect(component).toSnapshot();
  });

  it('renders disabled normal link', function () {
    const component = mountWithTheme(
      <Button href="/some/relative/url">Normal Link</Button>,
      routerContext
    );
    expect(component).toSnapshot();
  });

  it('calls `onClick` callback', function () {
    const spy = jest.fn();
    const component = mountWithTheme(<Button onClick={spy} />, routerContext);
    component.simulate('click');

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', function () {
    const spy = jest.fn();
    const component = mountWithTheme(<Button onClick={spy} disabled />, routerContext);
    component.simulate('click');

    expect(spy).not.toHaveBeenCalled();
  });
});
