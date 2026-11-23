import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {PeekingBug} from './peekingBug';

describe('PeekingBug', () => {
  beforeEach(() => {
    jest.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the wrapped button as the only control when hovered', async () => {
    const onClick = jest.fn();
    render(
      <PeekingBug>
        <Button onClick={onClick}>Start</Button>
      </PeekingBug>
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Start'}));
    await userEvent.click(screen.getByRole('button', {name: 'Start'}));

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('dismisses the bug when Escape is pressed during a hover', async () => {
    render(
      <PeekingBug>
        <Button>Start</Button>
      </PeekingBug>
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Start'}));
    await userEvent.keyboard('{Escape}');

    expect(screen.getByTestId('peeking-bug')).toHaveAttribute('data-dismissed');
  });

  it('lets the bug return when the pointer leaves after a dismissal', async () => {
    render(
      <PeekingBug>
        <Button>Start</Button>
      </PeekingBug>
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Start'}));
    await userEvent.keyboard('{Escape}');
    await userEvent.unhover(screen.getByRole('button', {name: 'Start'}));

    expect(screen.getByTestId('peeking-bug')).not.toHaveAttribute('data-dismissed');
  });

  it('ignores hovers when the device has no fine hover pointer', async () => {
    jest.mocked(window.matchMedia).mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    render(
      <PeekingBug>
        <Button>Start</Button>
      </PeekingBug>
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Start'}));
    await userEvent.keyboard('{Escape}');

    expect(screen.getByTestId('peeking-bug')).not.toHaveAttribute('data-dismissed');
  });
});
