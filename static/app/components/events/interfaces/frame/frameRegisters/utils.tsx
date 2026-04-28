import type {StacktraceType} from 'sentry/types/stacktrace';

import {
  REGISTERS_ARM,
  REGISTERS_ARM64,
  REGISTERS_MIPS,
  REGISTERS_PPC,
  REGISTERS_X86,
  REGISTERS_X86_64,
} from './registers';

function getRegisterMap(deviceArch: string) {
  if (deviceArch.startsWith('x86_64')) {
    return REGISTERS_X86_64;
  }

  if (deviceArch.startsWith('x86')) {
    return REGISTERS_X86;
  }

  if (deviceArch.startsWith('arm64')) {
    return REGISTERS_ARM64;
  }

  if (deviceArch.startsWith('arm')) {
    return REGISTERS_ARM;
  }

  if (deviceArch.startsWith('mips')) {
    return REGISTERS_MIPS;
  }

  if (deviceArch.startsWith('ppc')) {
    return REGISTERS_PPC;
  }

  return undefined;
}

function getRegisterIndex(register: string, registerMap: Record<string, number>) {
  return registerMap[register[0] === '$' ? register.slice(1) : register] ?? -1;
}

export function getSortedRegisters(
  registers: NonNullable<StacktraceType['registers']>,
  deviceArch?: string
) {
  const entries = Object.entries(registers);
  const registerMap = deviceArch ? getRegisterMap(deviceArch) : undefined;

  return entries.sort((a, b) => {
    if (registerMap) {
      const indexA = getRegisterIndex(a[0], registerMap);
      const indexB = getRegisterIndex(b[0], registerMap);

      // If both registers are in the map, sort by index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      // Mapped registers come before unmapped ones
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
    }

    // Fallback: natural sort (handles numeric suffixes correctly)
    return a[0].localeCompare(b[0], undefined, {numeric: true});
  });
}
