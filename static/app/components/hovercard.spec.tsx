import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Hovercard} from 'sentry/components/hovercard';

describe('Hovercard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Displays card', async () => {
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={0}
      >
        Hovercard Trigger
      </Hovercard>
    );

    await userEvent.hover(screen.getByText('Hovercard Trigger'));

    expect(await screen.findByText(/Hovercard Body/)).toBeInTheDocument();
    expect(await screen.findByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('Does not display card', async () => {
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={0}
        forceVisible={false}
      >
        Hovercard Trigger
      </Hovercard>
    );

    await userEvent.hover(screen.getByText('Hovercard Trigger'));

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();
  });

  it('Always displays card', () => {
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={0}
        forceVisible
      >
        Hovercard Trigger
      </Hovercard>
    );

    expect(screen.getByText(/Hovercard Body/)).toBeInTheDocument();
    expect(screen.getByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('Respects displayTimeout displays card', async () => {
    const DISPLAY_TIMEOUT = 100;
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        delay={DISPLAY_TIMEOUT}
        displayTimeout={DISPLAY_TIMEOUT}
      >
        Hovercard Trigger
      </Hovercard>
    );

    jest.useFakeTimers();
    await userEvent.hover(screen.getByText('Hovercard Trigger'), {delay: null});
    act(() => jest.advanceTimersByTime(DISPLAY_TIMEOUT - 1));

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1));

    expect(await screen.findByText(/Hovercard Body/)).toBeInTheDocument();
    expect(await screen.findByText(/Hovercard Header/)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('Doesnt leak timeout', async () => {
    const DISPLAY_TIMEOUT = 100;
    render(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        delay={DISPLAY_TIMEOUT}
        displayTimeout={DISPLAY_TIMEOUT}
      >
        Hovercard Trigger
      </Hovercard>
    );

    jest.useFakeTimers();
    await userEvent.hover(screen.getByText('Hovercard Trigger'), {delay: null});
    act(() => jest.advanceTimersByTime(DISPLAY_TIMEOUT - 1));

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();

    await userEvent.unhover(screen.getByText('Hovercard Trigger'), {delay: null});

    act(() => jest.advanceTimersByTime(1));
    jest.useRealTimers();

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();
  });
});
