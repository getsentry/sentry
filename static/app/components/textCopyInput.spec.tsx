import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TextCopyInput from 'sentry/components/textCopyInput';

describe('TextCopyInput', function () {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(''),
      },
    });
  });

  it('copies text to clipboard on click', async function () {
    render(<TextCopyInput>Text to Copy</TextCopyInput>);
    const button = screen.getByRole('button', {name: 'Copy'});
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Text to Copy');
  });

  it('selects text in input on click', async function () {
    render(<TextCopyInput>Text to Copy</TextCopyInput>);
    const input = screen.getByRole<HTMLInputElement>('textbox');
    expect(input).toHaveValue('Text to Copy');
    const selectSpy = vi.spyOn(input, 'select');

    await userEvent.click(input);

    expect(selectSpy).toHaveBeenCalled();
  });

  it('handles RTL text selection', async function () {
    render(<TextCopyInput rtl>Text to Copy</TextCopyInput>);
    const input = screen.getByRole<HTMLInputElement>('textbox');
    const setSelectionRangeSpy = vi.spyOn(input, 'setSelectionRange');

    await userEvent.click(input);
    expect(setSelectionRangeSpy).toHaveBeenCalledWith(1, input.value.length - 1);
  });
});
