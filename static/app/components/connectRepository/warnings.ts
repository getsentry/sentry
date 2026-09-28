import {normalizeRoot} from './normalization';
import type {PathMappingValue} from './type';

export type ExistingMapping = {repoName: string; sourceRoot: string; stackRoot: string};

export type PathMappingWarning =
  | {type: 'catchAll'}
  | {sourceRoot: string; stackRoot: string; type: 'exact'}
  | {repoName: string; sourceRoot: string; stackRoot: string; type: 'exactExisting'};

type NormalizedRow = {sourceRoot: string; stackRoot: string};
type NormalizedExisting = ExistingMapping;

function deriveWarning(
  row: NormalizedRow,
  index: number,
  rows: NormalizedRow[],
  existing: NormalizedExisting[]
): PathMappingWarning | null {
  const {stackRoot, sourceRoot} = row;

  if (stackRoot === '') {
    const existingEmpty = existing.find(
      e => e.stackRoot === '' && e.sourceRoot === sourceRoot
    );
    if (existingEmpty) {
      return {
        repoName: existingEmpty.repoName,
        sourceRoot: existingEmpty.sourceRoot,
        stackRoot: '',
        type: 'exactExisting',
      };
    }
    const otherEmpty = rows.find(
      (n, i) => i !== index && n.stackRoot === '' && n.sourceRoot === sourceRoot
    );
    if (otherEmpty) {
      return {sourceRoot: otherEmpty.sourceRoot, stackRoot: '', type: 'exact'};
    }
    return {type: 'catchAll'};
  }

  const existingExact = existing.find(
    e => e.stackRoot === stackRoot && e.sourceRoot === sourceRoot
  );
  if (existingExact) {
    return {
      repoName: existingExact.repoName,
      sourceRoot: existingExact.sourceRoot,
      stackRoot,
      type: 'exactExisting',
    };
  }

  const inFormExact = rows.find(
    (n, i) => i !== index && n.stackRoot === stackRoot && n.sourceRoot === sourceRoot
  );
  if (inFormExact) {
    return {sourceRoot: inFormExact.sourceRoot, stackRoot, type: 'exact'};
  }

  return null;
}

export function getPathMappingWarnings(
  values: PathMappingValue[],
  existing: ExistingMapping[] = []
): Array<PathMappingWarning | null> {
  const rows = values.map(v => ({
    stackRoot: normalizeRoot(v.stackRoot),
    sourceRoot: normalizeRoot(v.sourceRoot),
  }));
  const normExisting = existing.map(e => ({
    repoName: e.repoName,
    stackRoot: normalizeRoot(e.stackRoot),
    sourceRoot: normalizeRoot(e.sourceRoot),
  }));

  return rows.map((row, index) => deriveWarning(row, index, rows, normExisting));
}
