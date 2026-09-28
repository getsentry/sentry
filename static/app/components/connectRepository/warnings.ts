import {normalizeRoot} from './normalization';
import type {PathMappingValue} from './type';

export type PathMappingWarning =
  | {type: 'catchAll'}
  | {sourceRoot: string; stackRoot: string; type: 'exactInForm'}
  | {repoName: string; sourceRoot: string; stackRoot: string; type: 'exactAcrossRepos'};

export type ExistingMapping = {repoName: string; sourceRoot: string; stackRoot: string};

type NormalizedRow = {sourceRoot: string; stackRoot: string};

function deriveWarning(
  row: NormalizedRow,
  index: number,
  rows: NormalizedRow[],
  existing: ExistingMapping[]
): PathMappingWarning | null {
  const {stackRoot, sourceRoot} = row;

  const inFormDuplicate = rows.find(
    (other, i) =>
      i !== index && other.stackRoot === stackRoot && other.sourceRoot === sourceRoot
  );
  if (inFormDuplicate) {
    return {sourceRoot: inFormDuplicate.sourceRoot, stackRoot, type: 'exactInForm'};
  }

  const acrossReposDuplicate = existing.find(
    other => other.stackRoot === stackRoot && other.sourceRoot === sourceRoot
  );
  if (acrossReposDuplicate) {
    return {
      repoName: acrossReposDuplicate.repoName,
      sourceRoot: acrossReposDuplicate.sourceRoot,
      stackRoot,
      type: 'exactAcrossRepos',
    };
  }

  if (stackRoot === '') {
    return {type: 'catchAll'};
  }

  return null;
}

export function isExactWarning(
  warning: PathMappingWarning | null | undefined
): warning is Extract<PathMappingWarning, {type: 'exactInForm' | 'exactAcrossRepos'}> {
  return warning?.type === 'exactInForm' || warning?.type === 'exactAcrossRepos';
}

export function getPathMappingWarnings(
  values: PathMappingValue[],
  existingMappings: ExistingMapping[] = []
): Array<PathMappingWarning | null> {
  const rows = values.map(v => ({
    stackRoot: normalizeRoot(v.stackRoot),
    sourceRoot: normalizeRoot(v.sourceRoot),
  }));

  const normalizedExisting = existingMappings.map(m => ({
    repoName: m.repoName,
    stackRoot: normalizeRoot(m.stackRoot),
    sourceRoot: normalizeRoot(m.sourceRoot),
  }));

  return rows.map((row, index) => deriveWarning(row, index, rows, normalizedExisting));
}
