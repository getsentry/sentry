import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Tooltip} from '@sentry/scraps/tooltip';

import {Hovercard} from 'sentry/components/hovercard';

describe('Hovercard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not display card before hover', () => {
    render(
      <Hovercard position="top" body="Hovercard Body" header="Hovercard Header">
        Hovercard Trigger
      </Hovercard>
    );

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();
  });

  it('displays the card when hovered', async () => {
    render(
      <Hovercard position="top" body="Hovercard Body" header="Hovercard Header">
        Hovercard Trigger
      </Hovercard>
    );

    await userEvent.hover(screen.getByText('Hovercard Trigger'));

    expect(await screen.findByText(/Hovercard Body/)).toBeInTheDocument();
    expect(await screen.findByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('always displays card when forceVisible is true', async () => {
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        forceVisible
      >
        Hovercard Trigger
      </Hovercard>
    );

    expect(await screen.findByText(/Hovercard Body/)).toBeInTheDocument();
    expect(screen.getByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('respects displayTimeout to delay hiding card when hover is removed', async () => {
    const DISPLAY_TIMEOUT = 100;
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={DISPLAY_TIMEOUT}
      >
        Hovercard Trigger
      </Hovercard>
    );

    jest.useFakeTimers();
    await userEvent.hover(screen.getByText('Hovercard Trigger'), {delay: null});
    await userEvent.unhover(screen.getByText('Hovercard Trigger'), {delay: null});

    act(() => jest.advanceTimersByTime(DISPLAY_TIMEOUT - 1));
    jest.useRealTimers();

    expect(screen.getByText(/Hovercard Body/)).toBeInTheDocument();
    expect(screen.getByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('hides the cards after the display timeout when hover is removed', async () => {
    const DISPLAY_TIMEOUT = 100;
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={DISPLAY_TIMEOUT}
      >
        Hovercard Trigger
      </Hovercard>
    );

    jest.useFakeTimers();
    await userEvent.hover(screen.getByText('Hovercard Trigger'), {delay: null});
    await userEvent.unhover(screen.getByText('Hovercard Trigger'), {delay: null});

    act(() => jest.advanceTimersByTime(DISPLAY_TIMEOUT));
    jest.useRealTimers();

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();
  });

  it('does not snap-close when a tooltip inside the body is hovered', async () => {
    render(
      <Hovercard
        position="top"
        body={
          <Tooltip title="Inner tooltip content">
            <span>Inner trigger</span>
          </Tooltip>
        }
        header="Hovercard Header"
      >
        Hovercard Trigger
      </Hovercard>
    );

    await userEvent.hover(screen.getByText('Hovercard Trigger'));
    expect(await screen.findByText(/Hovercard Header/)).toBeInTheDocument();

    await userEvent.hover(screen.getByText('Inner trigger'));
    expect(screen.getByText(/Hovercard Header/)).toBeInTheDocument();
    expect(await screen.findByText('Inner tooltip content')).toBeInTheDocument();
  });
});
