import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button, LinkButton} from '@sentry/scraps/button';

describe('Button', () => {
  it('renders', () => {
    render(<Button priority="primary">Button</Button>);
  });

  it('calls `onClick` callback', async () => {
    const spy = jest.fn();
    render(<Button onClick={spy}>Click me</Button>);
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', async () => {
    const spy = jest.fn();
    render(
      <Button onClick={spy} disabled>
        Click me
      </Button>
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call `onClick` on busy buttons', async () => {
    const spy = jest.fn();
    render(
      <Button onClick={spy} busy>
        Click me
      </Button>
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('shows spinner when busy', () => {
    render(<Button busy>Busy Button</Button>);

    const button = screen.getByRole('button', {name: 'Busy'});
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status', {name: 'Busy'})).not.toHaveStyle({
      visibility: 'hidden',
    });
  });

  it('hides spinner when not busy', () => {
    render(<Button>Normal Button</Button>);

    expect(screen.queryByRole('status', {name: 'Busy'})).not.toBeInTheDocument();
  });
});

describe('LinkButton', () => {
  it('renders react-router link', () => {
    render(<LinkButton to="/some/route">Router Link</LinkButton>);
  });

  it('renders normal link', () => {
    render(<LinkButton href="/some/relative/url">Normal Link</LinkButton>);
    expect(screen.getByRole('button', {name: 'Normal Link'})).toHaveAttribute(
      'href',
      '/some/relative/url'
    );
  });

  it('renders disabled link', () => {
    render(
      <LinkButton disabled href="/some/relative/url">
        Disabled Link
      </LinkButton>
    );

    const element = screen.getByRole('button', {name: 'Disabled Link'});

    expect(element).not.toHaveAttribute('href');
    expect(element).toHaveAttribute('aria-disabled', 'true');
  });
});
