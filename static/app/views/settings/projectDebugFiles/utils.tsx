import {t} from 'sentry/locale';
import {DebugFile, DebugFileFeature, DebugFileType} from 'sentry/types/debugFiles';

const PRETTY_SYMBOL_TYPES = {
  proguard: t('ProGuard mapping'),
  breakpad: t('Breakpad'),
  macho: t('Mach-O'),
  elf: t('ELF'),
  pe: t('PE'),
  pdb: t('PDB'),
  portablepdb: t('Portable PDB'),
  sourcebundle: t('SourceBundle'),
  wasm: t('WebAssembly'),
  bcsymbolmap: t('BCSymbolMap'),
  il2cpp: t('IL2CPP mapping'),
};

const PRETTY_FILE_TYPES = {
  [DebugFileType.EXE]: t('executable'),
  [DebugFileType.DBG]: t('debug companion'),
  [DebugFileType.LIB]: t('dynamic library'),
};

/**
 * Give a pretty human-readable description of a `DebugFile`.
 * For example "ELF dynamic library (x86_64)"
 */
export function getPrettyFileType(dsym: DebugFile) {
  const {symbolType, data, cpuName} = dsym;

  const prettySymbolType = PRETTY_SYMBOL_TYPES[symbolType] ?? symbolType;
  const prettyFileType = PRETTY_FILE_TYPES[data?.type ?? '_'];
  const prettyCpuName =
    cpuName && cpuName !== 'any' && cpuName !== 'unknown' ? `(${cpuName})` : null;

  return [prettySymbolType, prettyFileType, prettyCpuName].filter(Boolean).join(' ');
}

export function getFeatureTooltip(feature: DebugFileFeature) {
  switch (feature) {
    case DebugFileFeature.SYMTAB:
      return t(
        'Symbol tables are used as a fallback when full debug information is not available'
      );
    case DebugFileFeature.DEBUG:
      return t(
        'Debug information provides function names and resolves inlined frames during symbolication'
      );
    case DebugFileFeature.UNWIND:
      return t(
        'Stack unwinding information improves the quality of stack traces extracted from minidumps'
      );
    case DebugFileFeature.SOURCES:
      return t(
        'Source code information allows Sentry to display source code context for stack frames'
      );
    default:
      return null;
  }
}
