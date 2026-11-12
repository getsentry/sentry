import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';

import {normalizeRoot} from './normalization';
import {isPendingWrite} from './queries';
import type {PathMappingValue} from './type';

export type PathMappingWarning =
  | {sourceRoot: string; stackRoot: string; type: 'catchAll'}
  | {type: 'codeOwner'}
  | {sourceRoot: string; stackRoot: string; type: 'exactInForm'}
  | {repoName: string; sourceRoot: string; stackRoot: string; type: 'exactAcrossRepos'};

type NormalizedRow = {
  checkAcrossRepos: boolean;
  hasCodeOwner: boolean;
  sourceRoot: string;
  stackRoot: string;
};

type SeededById = Map<string, RepositoryProjectPathConfig>;

type NormalizedExisting = {repoName: string; sourceRoot: string; stackRoot: string};

function deriveWarning(
  row: NormalizedRow,
  index: number,
  rows: NormalizedRow[],
  existing: NormalizedExisting[]
): PathMappingWarning | undefined {
  const {stackRoot, sourceRoot, hasCodeOwner, checkAcrossRepos} = row;

  const inFormDuplicate = rows.find(
    (other, i) =>
      i !== index && other.stackRoot === stackRoot && other.sourceRoot === sourceRoot
  );
  if (inFormDuplicate) {
    return {sourceRoot: inFormDuplicate.sourceRoot, stackRoot, type: 'exactInForm'};
  }

  const acrossReposDuplicate = checkAcrossRepos
    ? existing.find(
        other => other.stackRoot === stackRoot && other.sourceRoot === sourceRoot
      )
    : undefined;
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

// Unchanged seeded rows send no request, so a cross-repo duplicate on them can't
// fail on save and isn't worth warning about.
export function getPathMappingWarnings(
  values: PathMappingValue[],
  existingMappings: RepositoryProjectPathConfig[] = [],
  seededById: SeededById = new Map()
): Array<PathMappingWarning | undefined> {
  const rows = values.map(v => ({
    stackRoot: normalizeRoot(v.stackRoot),
    sourceRoot: normalizeRoot(v.sourceRoot),
    hasCodeOwner: v.hasCodeOwner ?? false,
    checkAcrossRepos: isPendingWrite(v, seededById),
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
  existingMappings: RepositoryProjectPathConfig[] = [],
  seededById: SeededById = new Map()
): boolean {
  return getPathMappingWarnings(mappings, existingMappings, seededById).some(
    isExactWarning
  );
}
