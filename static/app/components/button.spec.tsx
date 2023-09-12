import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/button';

describe('Button', function () {
  it('renders', function () {
    render(<Button priority="primary">Button</Button>);
  });

  it('renders react-router link', function () {
    render(<Button to="/some/route">Router Link</Button>);
  });

  it('renders normal link', function () {
    render(<Button href="/some/relative/url">Normal Link</Button>);
  });

  it('renders disabled normal link', function () {
    render(<Button href="/some/relative/url">Normal Link</Button>);
  });

  it('calls `onClick` callback', async function () {
    const spy = jest.fn();
    render(<Button onClick={spy}>Click me</Button>);
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', async function () {
    const spy = jest.fn();
    render(
      <Button onClick={spy} disabled>
        Click me
      </Button>
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });
});
