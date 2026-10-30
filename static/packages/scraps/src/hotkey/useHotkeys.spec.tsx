import {render, renderHook, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {useHotkeys} from '@sentry/scraps/hotkey';

describe('Sentry hotkey defaults', () => {
  it('keeps shortcuts in inputs opt-in, including modifier shortcuts', async () => {
    const callback = jest.fn();
    const {rerender} = renderHook(
      (options: {ignoreInputs?: boolean}) =>
        useHotkeys([{hotkey: 'Control+K', callback}], options),
      {initialProps: {}}
    );
    render(<input aria-label="Editor" />);
    await userEvent.click(screen.getByRole('textbox', {name: 'Editor'}));

    await userEvent.keyboard('{Control>}k{/Control}');
    expect(callback).not.toHaveBeenCalled();

    rerender({ignoreInputs: false});
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('allows key events to reach other listeners', async () => {
    const callback = jest.fn();
    renderHook(() => useHotkeys([{hotkey: 'K', callback}]));
    const listener = jest.fn();
    window.addEventListener('keydown', listener);

    await userEvent.keyboard('k');
    window.removeEventListener('keydown', listener);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
