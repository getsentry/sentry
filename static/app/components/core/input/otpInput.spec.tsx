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
    render(<OTPInput format="0000" onComplete={onComplete} />);

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.type(input, '1234');

    expect(input).toHaveValue('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('supports one-time-code autofill', () => {
    render(<OTPInput format="000000" onComplete={jest.fn()} />);

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toHaveAttribute(
      'autocomplete',
      'one-time-code'
    );
  });

  it('disables the native input', () => {
    render(<OTPInput disabled format="000000" onComplete={jest.fn()} />);

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toBeDisabled();
  });

  it('renders the requested number of visual slots', () => {
    render(<OTPInput format="000000" onComplete={jest.fn()} />);

    expect(document.querySelectorAll('[data-input-otp-slot]')).toHaveLength(6);
  });

  it('renders format separators without including them in the value', async () => {
    const onComplete = jest.fn();
    render(<OTPInput format="000-000" onComplete={onComplete} />);

    expect(screen.getByText('-')).toBeInTheDocument();

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.type(input, '123456');

    expect(input).toHaveValue('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('supports alphanumeric codes and uppercases their value', async () => {
    const onComplete = jest.fn();
    render(<OTPInput format="AAAA" onComplete={onComplete} uppercase />);

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.type(input, 'a1b2');

    expect(input).toHaveValue('A1B2');
    expect(onComplete).toHaveBeenCalledWith('A1B2');
  });
});
