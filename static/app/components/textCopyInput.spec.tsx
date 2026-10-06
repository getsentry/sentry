import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {TextCopyInput} from 'sentry/components/textCopyInput';

describe('TextCopyInput', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(''),
      },
    });
  });

  it('copies text to clipboard on click', async () => {
    render(<TextCopyInput>Text to Copy</TextCopyInput>);
    const button = screen.getByRole('button', {name: 'Copy to clipboard'});
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Text to Copy');
  });

  it('selects text in input on click', async () => {
    render(<TextCopyInput>Text to Copy</TextCopyInput>);
    const input = screen.getByRole<HTMLInputElement>('textbox');
    expect(input).toHaveValue('Text to Copy');
    const selectSpy = jest.spyOn(input, 'select');

    await userEvent.click(input);

    expect(selectSpy).toHaveBeenCalled();
  });
});
