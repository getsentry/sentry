import {fireEvent, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import Button from 'app/components/button';

describe('Button', function () {
  // @ts-expect-error
  const routerContext = TestStubs.routerContext();

  it('renders', function () {
    const {container} = mountWithTheme(<Button priority="primary">Button</Button>);
    expect(container).toSnapshot();
  });

  it('renders react-router link', function () {
    const {container} = mountWithTheme(<Button to="/some/route">Router Link</Button>, {
      context: routerContext,
    });
    expect(container).toSnapshot();
  });

  it('renders normal link', function () {
    const {container} = mountWithTheme(
      <Button href="/some/relative/url">Normal Link</Button>,
      {context: routerContext}
    );
    expect(container).toSnapshot();
  });

  it('renders disabled normal link', function () {
    const {container} = mountWithTheme(
      <Button href="/some/relative/url">Normal Link</Button>,
      {context: routerContext}
    );
    expect(container).toSnapshot();
  });

  it('calls `onClick` callback', function () {
    const spy = jest.fn();
    const {getByText} = mountWithTheme(<Button onClick={spy}>Click me</Button>, {
      context: routerContext,
    });
    fireEvent.click(getByText('Click me'));

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', function () {
    const spy = jest.fn();
    const {getByText} = mountWithTheme(
      <Button onClick={spy} disabled>
        Click me
      </Button>,
      {context: routerContext}
    );
    fireEvent.click(getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });
});
