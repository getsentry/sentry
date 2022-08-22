import {
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
    return REGISTERS_ARM64;
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
  registers: Record<string, string | null>,
  deviceArch?: string
) {
  const entries = Object.entries(registers);

  if (!deviceArch) {
    return entries;
  }

  const registerMap = getRegisterMap(deviceArch);

  if (!registerMap) {
    return entries;
  }

  return entries.sort(
    (a, b) => getRegisterIndex(a[0], registerMap) - getRegisterIndex(b[0], registerMap)
  );
}
