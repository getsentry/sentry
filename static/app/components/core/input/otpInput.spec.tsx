import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OTPInput} from '@sentry/scraps/input';

describe('OTPInput', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => null),
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('accepts characters and reports a filled code', async () => {
    const onComplete = jest.fn();
    render(<OTPInput length={4} onComplete={onComplete} />);

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.type(input, '1234');

    expect(input).toHaveValue('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('supports one-time-code autofill', () => {
    render(<OTPInput length={6} onComplete={jest.fn()} />);

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toHaveAttribute(
      'autocomplete',
      'one-time-code'
    );
  });

  it('disables the native input', () => {
    render(<OTPInput disabled length={6} onComplete={jest.fn()} />);

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toBeDisabled();
  });

  it('renders the requested number of visual slots', () => {
    render(<OTPInput length={6} onComplete={jest.fn()} />);

    expect(document.querySelectorAll('[data-input-otp-slot]')).toHaveLength(6);
  });

  it('supports alphanumeric codes and transforms their value', async () => {
    const onComplete = jest.fn();
    render(
      <OTPInput
        characterSet="alphanumeric"
        length={4}
        onComplete={onComplete}
        transform={value => value.toUpperCase()}
      />
    );

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.type(input, 'a1b2');

    expect(input).toHaveValue('A1B2');
    expect(onComplete).toHaveBeenCalledWith('A1B2');
  });
});
