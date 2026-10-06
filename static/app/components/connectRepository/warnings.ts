import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';

import {normalizeRoot} from './normalization';
import type {PathMappingValue} from './type';

export type PathMappingWarning =
  | {sourceRoot: string; stackRoot: string; type: 'catchAll'}
  | {type: 'codeOwner'}
  | {sourceRoot: string; stackRoot: string; type: 'exactInForm'}
  | {repoName: string; sourceRoot: string; stackRoot: string; type: 'exactAcrossRepos'};

type NormalizedRow = {hasCodeOwner: boolean; sourceRoot: string; stackRoot: string};

type NormalizedExisting = {repoName: string; sourceRoot: string; stackRoot: string};

function deriveWarning(
  row: NormalizedRow,
  index: number,
  rows: NormalizedRow[],
  existing: NormalizedExisting[]
): PathMappingWarning | undefined {
  const {stackRoot, sourceRoot, hasCodeOwner} = row;

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

  if (stackRoot === '' || sourceRoot === '') {
    return {type: 'catchAll', stackRoot, sourceRoot};
  }

  return undefined;
}

export function isExactWarning(
  warning: PathMappingWarning | undefined
): warning is Extract<PathMappingWarning, {type: 'exactInForm' | 'exactAcrossRepos'}> {
  return warning?.type === 'exactInForm' || warning?.type === 'exactAcrossRepos';
}

export function getPathMappingWarnings(
  values: PathMappingValue[],
  existingMappings: RepositoryProjectPathConfig[] = []
): Array<PathMappingWarning | undefined> {
  const rows = values.map(v => ({
    stackRoot: normalizeRoot(v.stackRoot),
    sourceRoot: normalizeRoot(v.sourceRoot),
    hasCodeOwner: v.hasCodeOwner ?? false,
  }));

  const normalizedExisting: NormalizedExisting[] = existingMappings.map(m => ({
    repoName: m.repoName,
    stackRoot: normalizeRoot(m.stackRoot),
    sourceRoot: normalizeRoot(m.sourceRoot),
  }));

  return rows.map((row, index) => deriveWarning(row, index, rows, normalizedExisting));
}

export function hasExactDuplicate(
  mappings: PathMappingValue[],
  existingMappings: RepositoryProjectPathConfig[] = []
): boolean {
  return getPathMappingWarnings(mappings, existingMappings).some(isExactWarning);
}
