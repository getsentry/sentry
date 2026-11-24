import {Fragment} from 'react';

import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useHandoffPromptInteractions} from './useHandoffPromptInteractions';

function Example({onCopy}: {onCopy: () => void}) {
  const {promptProps} = useHandoffPromptInteractions(onCopy);

  return (
    <Fragment>
      <input aria-label="Prior input" />
      <div {...promptProps}>Open the instructions. Your handoff code is sntryh_****.</div>
    </Fragment>
  );
}

describe('useHandoffPromptInteractions', () => {
  afterEach(() => window.getSelection()?.removeAllRanges());

  it('selects the complete displayed prompt on primary pointer down', async () => {
    render(<Example onCopy={jest.fn()} />);
    const prompt = screen.getByText(/Open the instructions/);
    screen.getByRole('textbox', {name: 'Prior input'}).focus();

    await userEvent.pointer({keys: '[MouseLeft>]', target: prompt});

    expect(prompt).toHaveFocus();
    expect(window.getSelection()?.toString()).toBe(prompt.textContent);
    await userEvent.pointer({keys: '[/MouseLeft]', target: prompt});
  });

  it('leaves the selection unchanged for non-primary pointers', async () => {
    render(<Example onCopy={jest.fn()} />);
    const prompt = screen.getByText(/Open the instructions/);

    await userEvent.pointer({keys: '[MouseRight]', target: prompt});

    expect(window.getSelection()?.toString()).toBe('');
  });

  it('replaces the native copy behavior with the supplied copy action', () => {
    const onCopy = jest.fn();
    render(<Example onCopy={onCopy} />);

    const copiedNatively = fireEvent.copy(screen.getByText(/Open the instructions/));

    expect(copiedNatively).toBe(false);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
