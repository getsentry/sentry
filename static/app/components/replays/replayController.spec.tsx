import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, userEvent} from 'sentry-test/reactTestingLibrary';

import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';

import {ReplayPlayPauseBar} from './replayController';

describe('ReplayPlayPauseBar keyboard shortcuts', () => {
  function renderComponent({
    currentTime = 10_000,
    isFinished = false,
    isPlaying = false,
    isLoading = false,
  }: {
    currentTime?: number;
    isFinished?: boolean;
    isLoading?: boolean;
    isPlaying?: boolean;
  } = {}) {
    const setCurrentTime = jest.fn();
    const togglePlayPause = jest.fn();
    const restart = jest.fn();

    render(
      <ReplayContextProvider
        analyticsContext="test"
        isFetching={false}
        replay={null}
        value={{
          currentTime,
          isFinished,
          isPlaying,
          restart,
          setCurrentTime,
          togglePlayPause,
        }}
      >
        <ReplayPlayPauseBar isLoading={isLoading} />
      </ReplayContextProvider>,
      {
        organization: OrganizationFixture({
          features: [],
        }),
      }
    );

    return {restart, setCurrentTime, togglePlayPause};
  }

  it('toggles play on spacebar', async () => {
    const {togglePlayPause} = renderComponent({isPlaying: false});

    await userEvent.keyboard('{Space}');

    expect(togglePlayPause).toHaveBeenCalledWith(true);
  });

  it('restarts replay on spacebar when replay is finished', async () => {
    const {restart, togglePlayPause} = renderComponent({isFinished: true});

    await userEvent.keyboard('{Space}');

    expect(restart).toHaveBeenCalledTimes(1);
    expect(togglePlayPause).not.toHaveBeenCalled();
  });

  it('skips backward and forward with arrow keys', async () => {
    const {setCurrentTime} = renderComponent({currentTime: 10_000});

    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{ArrowRight}');

    expect(setCurrentTime).toHaveBeenNthCalledWith(1, 5_000);
    expect(setCurrentTime).toHaveBeenNthCalledWith(2, 15_000);
  });

  it('does not trigger shortcuts while typing in an input', async () => {
    const {setCurrentTime, togglePlayPause} = renderComponent();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Space}');

    expect(setCurrentTime).not.toHaveBeenCalled();
    expect(togglePlayPause).not.toHaveBeenCalled();

    input.remove();
  });
});
