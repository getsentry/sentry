import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

describe('RevealOnHover', () => {
  it('renders children and action', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <Button>Copy</Button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
  });

  it('wraps action children with a data-reveal-on-hover element', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <Button>Copy</Button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    const button = screen.getByRole('button', {name: 'Copy'});
    expect(button.closest('[data-reveal-on-hover]')).toBeInTheDocument();
  });

  it('does not wrap with data-reveal-on-hover when visible is true', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action visible>
          <Button>Copy</Button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    const button = screen.getByRole('button', {name: 'Copy'});
    expect(button.closest('[data-reveal-on-hover]')).not.toBeInTheDocument();
  });

  it('passes through Flex props to the root element', () => {
    render(
      <RevealOnHover data-test-id="hover-root" gap="md" justify="between">
        <span>Label</span>
        <RevealOnHover.Action>
          <Button>Copy</Button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    expect(screen.getByTestId('hover-root')).toBeInTheDocument();
  });

  it('action button is clickable', async () => {
    const onClick = jest.fn();

    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <Button onClick={onClick}>Copy</Button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports multiple actions', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <Button>Copy</Button>
        </RevealOnHover.Action>
        <RevealOnHover.Action>
          <Button aria-label="Delete">Delete</Button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    const copyButton = screen.getByRole('button', {name: 'Copy'});
    const deleteButton = screen.getByRole('button', {name: 'Delete'});
    expect(copyButton.closest('[data-reveal-on-hover]')).toBeInTheDocument();
    expect(deleteButton.closest('[data-reveal-on-hover]')).toBeInTheDocument();
  });

  it('action button is focusable via keyboard', async () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <Button>Copy</Button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Copy'})).toHaveFocus();
  });

  it('supports callback children for custom elements', () => {
    render(
      <RevealOnHover>
        {({className}) => (
          <div data-test-id="custom-root" className={className}>
            <span>Grid content</span>
            <RevealOnHover.Action>
              <Button>Copy</Button>
            </RevealOnHover.Action>
          </div>
        )}
      </RevealOnHover>
    );

    expect(screen.getByTestId('custom-root')).toBeInTheDocument();
    expect(screen.getByText('Grid content')).toBeInTheDocument();
    const button = screen.getByRole('button', {name: 'Copy'});
    expect(button.closest('[data-reveal-on-hover]')).toBeInTheDocument();
  });

  it('callback children action button is clickable', async () => {
    const onClick = jest.fn();

    render(
      <RevealOnHover>
        {({className}) => (
          <div className={className}>
            <span>Content</span>
            <RevealOnHover.Action>
              <Button onClick={onClick}>Copy</Button>
            </RevealOnHover.Action>
          </div>
        )}
      </RevealOnHover>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
