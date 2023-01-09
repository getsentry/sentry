import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Button from 'sentry/components/button';

describe('Button', function () {
  it('renders', function () {
    const {container} = render(<Button priority="primary">Button</Button>);
    expect(container).toMatchSnapshot();
  });

  it('renders react-router link', function () {
    const {container} = render(<Button to="/some/route">Router Link</Button>);
    expect(container).toMatchSnapshot();
  });

  it('renders normal link', function () {
    const {container} = render(<Button href="/some/relative/url">Normal Link</Button>);
    expect(container).toMatchSnapshot();
  });

  it('renders disabled normal link', function () {
    const {container} = render(<Button href="/some/relative/url">Normal Link</Button>);
    expect(container).toMatchSnapshot();
  });

  it('calls `onClick` callback', function () {
    const spy = jest.fn();
    render(<Button onClick={spy}>Click me</Button>);
    userEvent.click(screen.getByText('Click me'));

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', function () {
    const spy = jest.fn();
    render(
      <Button onClick={spy} disabled>
        Click me
      </Button>
    );
    userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });
});
