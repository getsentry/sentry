import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {StreamingDemo} from './components';

describe('StreamingDemo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    try {
      act(() => jest.runOnlyPendingTimers());
    } finally {
      jest.useRealTimers();
    }
  });

  it('lets the story enable a delay before streaming', async () => {
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
    render(<StreamingDemo />);

    const toggle = screen.getByRole('checkbox', {name: '500 ms delay'});
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();

    await user.click(screen.getByRole('button', {name: 'Start Stream'}));
    expect(toggle).toBeDisabled();
    act(() => jest.advanceTimersByTime(250));
    expect(
      screen.queryAllByText(/./, {selector: '[data-scraps-decode]'}).length
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', {name: 'Reset'}));
    expect(toggle).toBeEnabled();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
  });
});
