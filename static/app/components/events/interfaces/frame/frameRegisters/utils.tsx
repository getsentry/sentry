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
  const normalizedDeviceArch = deviceArch.trim().toLowerCase();

  if (
    normalizedDeviceArch.startsWith('x86_64') ||
    normalizedDeviceArch.startsWith('amd64')
  ) {
    return REGISTERS_X86_64;
  }

  if (
    normalizedDeviceArch.startsWith('x86') ||
    normalizedDeviceArch.startsWith('i386') ||
    normalizedDeviceArch.startsWith('i686')
  ) {
    return REGISTERS_X86;
  }

  if (
    normalizedDeviceArch.startsWith('arm64') ||
    normalizedDeviceArch.startsWith('aarch64')
  ) {
    return REGISTERS_ARM64;
  }

  if (normalizedDeviceArch.startsWith('arm')) {
    return REGISTERS_ARM;
  }

  if (normalizedDeviceArch.startsWith('mips')) {
    return REGISTERS_MIPS;
  }

  if (normalizedDeviceArch.startsWith('ppc')) {
    return REGISTERS_PPC;
  }

  return;
}

function normalizeRegisterName(register: string) {
  return register.startsWith('$') ? register.slice(1) : register;
}

function getRegisterIndex(register: string, registerMap: Record<string, number>) {
  return registerMap[normalizeRegisterName(register)];
}

function compareRegisterNames(a: string, b: string) {
  return normalizeRegisterName(a).localeCompare(normalizeRegisterName(b), undefined, {
    numeric: true,
  });
}

export function getSortedRegisters(
  registers: NonNullable<StacktraceType['registers']>,
  deviceArch: string | undefined
) {
  const entries = Object.entries(registers);
  const registerMap = deviceArch ? getRegisterMap(deviceArch) : undefined;

  return entries.sort((a, b) => {
    if (registerMap) {
      const indexA = getRegisterIndex(a[0], registerMap);
      const indexB = getRegisterIndex(b[0], registerMap);

      // If both registers are in the map, sort by index
      if (indexA !== undefined && indexB !== undefined) {
        return indexA - indexB || compareRegisterNames(a[0], b[0]);
      }

      // Mapped registers come before unmapped ones
      if (indexA !== undefined) {
        return -1;
      }
      if (indexB !== undefined) {
        return 1;
      }
    }

    // Fallback: natural sort (handles numeric suffixes correctly)
    return compareRegisterNames(a[0], b[0]);
  });
}
