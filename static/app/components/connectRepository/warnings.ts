import {normalizeRoot} from './normalization';
import type {PathMappingValue} from './type';

export type PathMappingWarning =
  | {type: 'catchAll'}
  | {type: 'codeOwner'}
  | {sourceRoot: string; stackRoot: string; type: 'exact'};

type NormalizedRow = {sourceRoot: string; stackRoot: string};

function deriveWarning(
  row: NormalizedRow,
  index: number,
  rows: NormalizedRow[]
): PathMappingWarning | null {
  const {stackRoot, sourceRoot} = row;

  const duplicate = rows.find(
    (other, i) =>
      i !== index && other.stackRoot === stackRoot && other.sourceRoot === sourceRoot
  );
  if (duplicate) {
    return {sourceRoot: duplicate.sourceRoot, stackRoot, type: 'exact'};
  }

  if (stackRoot === '') {
    return {type: 'catchAll'};
  }

  return null;
}

export function getPathMappingWarnings(
  values: PathMappingValue[]
): Array<PathMappingWarning | null> {
  const rows = values.map(v => ({
    stackRoot: normalizeRoot(v.stackRoot),
    sourceRoot: normalizeRoot(v.sourceRoot),
  }));

  return rows.map((row, index) => deriveWarning(row, index, rows));
}

export function hasExactDuplicate(mappings: PathMappingValue[]): boolean {
  return getPathMappingWarnings(mappings).some(w => w?.type === 'exact');
}
