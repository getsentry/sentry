import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button, LinkButton} from 'sentry/components/button';

describe('Button', function () {
  it('renders', function () {
    render(<Button priority="primary">Button</Button>);
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

describe('LinkButton', function () {
  it('renders react-router link', function () {
    render(<LinkButton to="/some/route">Router Link</LinkButton>);
  });

  it('renders normal link', function () {
    render(<LinkButton href="/some/relative/url">Normal Link</LinkButton>);
    expect(screen.getByRole('button', {name: 'Normal Link'})).toHaveAttribute(
      'href',
      '/some/relative/url'
    );
  });

  it('renders disabled link', function () {
    render(
      <LinkButton disabled href="/some/relative/url">
        Disabled Link
      </LinkButton>
    );
    expect(screen.getByRole('button', {name: 'Disabled Link'})).toBeDisabled();
  });
});
