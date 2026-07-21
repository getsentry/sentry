import {getSortedRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters/utils';

describe('getSortedRegisters', () => {
  it('naturally sorts register names without a device architecture', () => {
    const registers = {
      fp: '0x0000000000000001',
      x0: '0x0000000000000002',
      x1: '0x0000000000000003',
      x10: '0x0000000000000004',
      x2: '0x0000000000000005',
      x20: '0x0000000000000006',
      x3: '0x0000000000000007',
    };

    const sorted = getSortedRegisters(registers, undefined);

    expect(sorted.map(([name]) => name)).toEqual([
      'fp',
      'x0',
      'x1',
      'x2',
      'x3',
      'x10',
      'x20',
    ]);
  });

  it('uses architecture order before naturally sorted unmapped registers', () => {
    const registers = {
      custom10: '0x0000000000000010',
      custom2: '0x0000000000000002',
      r10: '0x000000000000000a',
      r8: '0x0000000000000008',
      rax: '0x0000000000000000',
      rbx: '0x0000000000000003',
      rip: '0x0000000000000010',
    };

    const sorted = getSortedRegisters(registers, 'x86_64');

    expect(sorted.map(([name]) => name)).toEqual([
      'rax',
      'rbx',
      'r8',
      'r10',
      'rip',
      'custom2',
      'custom10',
    ]);
  });

  it('supports documented architecture aliases', () => {
    const x86Registers = {
      eax: '0x00000001',
      ebx: '0x00000004',
      ecx: '0x00000002',
      edx: '0x00000003',
    };
    const x86_64Registers = {
      rax: '0x0000000000000001',
      rbx: '0x0000000000000004',
      rcx: '0x0000000000000003',
      rdx: '0x0000000000000002',
    };
    const arm64Registers = {
      fp: '0x000000000000001d',
      lr: '0x000000000000001e',
      pc: '0x0000000000000020',
      sp: '0x000000000000001f',
      x0: '0x0000000000000000',
    };

    expect(getSortedRegisters(x86Registers, 'i386').map(([name]) => name)).toEqual([
      'eax',
      'ecx',
      'edx',
      'ebx',
    ]);
    expect(getSortedRegisters(x86Registers, 'i686').map(([name]) => name)).toEqual([
      'eax',
      'ecx',
      'edx',
      'ebx',
    ]);
    expect(getSortedRegisters(x86_64Registers, 'amd64').map(([name]) => name)).toEqual([
      'rax',
      'rdx',
      'rcx',
      'rbx',
    ]);
    expect(getSortedRegisters(arm64Registers, 'aarch64').map(([name]) => name)).toEqual([
      'x0',
      'fp',
      'lr',
      'sp',
      'pc',
    ]);
  });

  it('uses register names to consistently order aliases with the same index', () => {
    const registers = {
      x29: '0x000000000000001d',
      fp: '0x000000000000001d',
    };

    const sorted = getSortedRegisters(registers, 'arm64');

    expect(sorted.map(([name]) => name)).toEqual(['fp', 'x29']);
  });
});
