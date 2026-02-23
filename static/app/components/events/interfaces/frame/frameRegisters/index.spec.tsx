import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters';
import {getSortedRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters/utils';
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

  it('should sort registers numerically without deviceArch', () => {
    const registers = {
      r0: '0x0000000000000000',
      r1: '0x0000000000000001',
      r10: '0x000000000000000a',
      r12: '0x000000000000000c',
      r2: '0x0000000000000002',
      r3: '0x0000000000000003',
    };

    const sorted = getSortedRegisters(registers);
    expect(sorted.map(([name]) => name)).toEqual(['r0', 'r1', 'r2', 'r3', 'r10', 'r12']);
  });

  it('should sort registers numerically with deviceArch', () => {
    const registers = {
      r0: '0x0000000000000000',
      r1: '0x0000000000000001',
      r10: '0x000000000000000a',
      r12: '0x000000000000000c',
      r2: '0x0000000000000002',
      r3: '0x0000000000000003',
    };

    const sorted = getSortedRegisters(registers, 'arm');
    expect(sorted.map(([name]) => name)).toEqual(['r0', 'r1', 'r2', 'r3', 'r10', 'r12']);
  });

  it('should sort x86_64 registers by map index with numeric fallback for unmapped', () => {
    // Simulate x86_64 registers in lexicographic (wrong) insertion order
    const registers = {
      r10: '0x000000000000000a',
      r11: '0x000000000000000b',
      r8: '0x0000000000000008',
      r9: '0x0000000000000009',
      rax: '0x0000000000000000',
      rbx: '0x0000000000000003',
      rip: '0x0000000000000010',
    };

    const sorted = getSortedRegisters(registers, 'x86_64');
    expect(sorted.map(([name]) => name)).toEqual([
      'rax',
      'rbx',
      'r8',
      'r9',
      'r10',
      'r11',
      'rip',
    ]);
  });

  it('should sort arm64 registers numerically without deviceArch', () => {
    // Registers as they might arrive from the server in insertion order
    const registers = {
      fp: '0x0000000000000001',
      lr: '0x0000000000000002',
      pc: '0x0000000000000003',
      sp: '0x0000000000000004',
      x0: '0x0000000000000005',
      x1: '0x0000000000000006',
      x10: '0x0000000000000007',
      x2: '0x0000000000000008',
      x20: '0x0000000000000009',
      x3: '0x000000000000000a',
    };

    const sorted = getSortedRegisters(registers);
    expect(sorted.map(([name]) => name)).toEqual([
      'fp',
      'lr',
      'pc',
      'sp',
      'x0',
      'x1',
      'x2',
      'x3',
      'x10',
      'x20',
    ]);
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
