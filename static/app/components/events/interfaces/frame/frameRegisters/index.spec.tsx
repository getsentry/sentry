import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters';
import {FrameRegisterValue} from 'sentry/components/events/interfaces/frame/frameRegisters/value';

describe('FrameRegisters', () => {
  it('should render registers', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: '0xffffffffffffffff',
      r12: '0x0000000000000000',
    };

    render(<FrameRegisters registers={registers} />);
    expect(screen.getByText('r10')).toBeInTheDocument();
    expect(screen.getByText('0x00007fff9300bf70')).toBeInTheDocument();
  });

  it('should skip registers without a value', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: null,
      r12: '0x0000000000000000',
    };

    render(<FrameRegisters registers={registers} />);
    expect(screen.getByText('r10')).toBeInTheDocument();
    expect(screen.getByText('0x00007fff9300bf70')).toBeInTheDocument();
    expect(screen.queryByText('r11')).not.toBeInTheDocument();
  });
});

describe('FrameRegistersValue', () => {
  const hexadecimalValue = '0x000000000000000a';
  const numericValue = 10;

  describe('with string value', () => {
    it('should display the hexadecimal value and toggle to numeric value', async () => {
      render(<FrameRegisterValue value={hexadecimalValue} />);
      expect(screen.getByText(hexadecimalValue)).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', {name: 'Toggle register value format'})
      );
      expect(screen.queryByText(hexadecimalValue)).not.toBeInTheDocument();
      expect(screen.getByText(numericValue)).toBeInTheDocument();
    });
  });

  describe('with numeric value', () => {
    it('should display the hexadecimal value and toggle to numeric value', async () => {
      render(<FrameRegisterValue value={numericValue} />);
      expect(screen.getByText(hexadecimalValue)).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', {name: 'Toggle register value format'})
      );
      expect(screen.queryByText(hexadecimalValue)).not.toBeInTheDocument();
      expect(screen.getByText(numericValue)).toBeInTheDocument();
    });
  });

  describe('with unknown value', () => {
    const unknownValue = 'xyz';

    it('should display the hexadecimal value and toggle to numeric value', async () => {
      render(<FrameRegisterValue value={unknownValue} />);
      expect(screen.getByText(unknownValue)).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', {name: 'Toggle register value format'})
      );
      expect(screen.getByText(unknownValue)).toBeInTheDocument();
    });
  });
});
