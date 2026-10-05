import {normalizeRoot} from './normalization';
import type {PathMappingValue} from './type';

export type PathMappingWarning =
  | {type: 'catchAll'}
  | {type: 'codeOwner'}
  | {sourceRoot: string; stackRoot: string; type: 'exactInForm'}
  | {repoName: string; sourceRoot: string; stackRoot: string; type: 'exactAcrossRepos'};

type ExistingMapping = {repoName: string; sourceRoot: string; stackRoot: string};

type NormalizedRow = {hasCodeOwner: boolean; sourceRoot: string; stackRoot: string};

function deriveWarning(
  row: NormalizedRow,
  index: number,
  rows: NormalizedRow[],
  existing: ExistingMapping[]
): PathMappingWarning | null {
  const {stackRoot, sourceRoot, hasCodeOwner} = row;

  // Exact duplicates always take priority over Code Owners.
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

  if (hasCodeOwner) {
    return {type: 'codeOwner'};
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
    hasCodeOwner: v.hasCodeOwner ?? false,
  }));

  const normalizedExisting = existingMappings.map(m => ({
    repoName: m.repoName,
    stackRoot: normalizeRoot(m.stackRoot),
    sourceRoot: normalizeRoot(m.sourceRoot),
  }));

  return rows.map((row, index) => deriveWarning(row, index, rows, normalizedExisting));
}

export function hasExactDuplicate(mappings: PathMappingValue[]): boolean {
  return getPathMappingWarnings(mappings).some(isExactWarning);
}
