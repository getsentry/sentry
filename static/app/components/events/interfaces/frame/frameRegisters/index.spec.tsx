import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters';
import {FrameRegisterValue} from 'sentry/components/events/interfaces/frame/frameRegisters/value';

describe('FrameRegisters', function () {
  it('should render registers', function () {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: '0xffffffffffffffff',
      r12: '0x0000000000000000',
    };

    render(<FrameRegisters registers={registers} />);
  });

  it('should skip registers without a value', function () {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: null,
      r12: '0x0000000000000000',
    };

    render(<FrameRegisters registers={registers} />);
  });
});

describe('FrameRegistersValue', function () {
  const hexadecimalValue = '0x000000000000000a';
  const numericValue = 10;

  describe('with string value', function () {
    it('should display the hexadecimal value', function () {
      render(<FrameRegisterValue value={hexadecimalValue} />);
      expect(screen.getByText(hexadecimalValue)).toBeInTheDocument();
    });

    it('should display the numeric value', async function () {
      render(<FrameRegisterValue value={hexadecimalValue} />);
      await userEvent.click(screen.getByLabelText('Toggle register value format'));
      expect(screen.queryByText(hexadecimalValue)).not.toBeInTheDocument();
      expect(screen.getByText(numericValue)).toBeInTheDocument();
    });
  });

  describe('with numeric value', function () {
    it('should display the hexadecimal value', function () {
      render(<FrameRegisterValue value={numericValue} />);
      expect(screen.getByText(hexadecimalValue)).toBeInTheDocument();
    });

    it('should display the numeric value', async function () {
      render(<FrameRegisterValue value={numericValue} />);
      await userEvent.click(screen.getByLabelText('Toggle register value format'));
      expect(screen.queryByText(hexadecimalValue)).not.toBeInTheDocument();
      expect(screen.getByText(numericValue)).toBeInTheDocument();
    });
  });

  describe('with unknown value', function () {
    const unknownValue = 'xyz';

    it('should display the hexadecimal value', function () {
      render(<FrameRegisterValue value={unknownValue} />);
      expect(screen.getByText(unknownValue)).toBeInTheDocument();
    });

    it('should display the numeric value', async function () {
      render(<FrameRegisterValue value={unknownValue} />);
      await userEvent.click(screen.getByLabelText('Toggle register value format'));
      expect(screen.getByText(unknownValue)).toBeInTheDocument();
    });
  });
});
