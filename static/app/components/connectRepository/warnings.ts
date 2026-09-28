import {normalizeRoot} from './normalization';
import type {PathMappingValue} from './type';

export type ExistingMapping = {repoName: string; sourceRoot: string; stackRoot: string};

export type PathMappingWarning =
  | {type: 'catchAll'}
  | {sourceRoot: string; stackRoot: string; type: 'exact'}
  | {repoName: string; sourceRoot: string; stackRoot: string; type: 'exactExisting'}
  | {sourceRoot: string; stackRoot: string; type: 'overlap'}
  | {repoName: string; stackRoot: string; type: 'overlapExisting'};

type NormalizedRow = {sourceRoot: string; stackRoot: string};
type NormalizedExisting = ExistingMapping;

function longestPrefixInForm(
  stackRoot: string,
  index: number,
  rows: NormalizedRow[]
): NormalizedRow | null {
  return rows.reduce<NormalizedRow | null>((best, n, i) => {
    if (i === index || n.stackRoot === '' || n.stackRoot === stackRoot) {
      return best;
    }
    if (!n.stackRoot.startsWith(stackRoot)) {
      return best;
    }
    return !best || n.stackRoot.length > best.stackRoot.length ? n : best;
  }, null);
}

function longestPrefixExisting(
  stackRoot: string,
  existing: NormalizedExisting[]
): NormalizedExisting | null {
  return existing.reduce<NormalizedExisting | null>((best, e) => {
    if (e.stackRoot === '' || e.stackRoot === stackRoot) {
      return best;
    }
    if (!e.stackRoot.startsWith(stackRoot)) {
      return best;
    }
    return !best || e.stackRoot.length > best.stackRoot.length ? e : best;
  }, null);
}

function deriveWarning(
  stackRoot: string,
  index: number,
  rows: NormalizedRow[],
  existing: NormalizedExisting[]
): PathMappingWarning | null {
  // Empty stack root: catch-all, or unused duplicate
  if (stackRoot === '') {
    const existingEmpty = existing.find(e => e.stackRoot === '');
    if (existingEmpty) {
      return {
        repoName: existingEmpty.repoName,
        sourceRoot: existingEmpty.sourceRoot,
        stackRoot: '',
        type: 'exactExisting',
      };
    }
    const otherEmpty = rows.find((n, i) => i !== index && n.stackRoot === '');
    if (otherEmpty) {
      return {sourceRoot: otherEmpty.sourceRoot, stackRoot: '', type: 'exact'};
    }
    return {type: 'catchAll'};
  }

  // Exact match: existing takes priority over in-form
  const existingExact = existing.find(e => e.stackRoot === stackRoot);
  if (existingExact) {
    return {
      repoName: existingExact.repoName,
      sourceRoot: existingExact.sourceRoot,
      stackRoot,
      type: 'exactExisting',
    };
  }
  const inFormExact = rows.find((n, i) => i !== index && n.stackRoot === stackRoot);
  if (inFormExact) {
    return {sourceRoot: inFormExact.sourceRoot, stackRoot, type: 'exact'};
  }

  // Prefix overlap: pick the longest matching root, preferring existing on tie
  const bestInForm = longestPrefixInForm(stackRoot, index, rows);
  const bestExisting = longestPrefixExisting(stackRoot, existing);

  if (
    bestExisting &&
    (!bestInForm || bestExisting.stackRoot.length >= bestInForm.stackRoot.length)
  ) {
    return {
      repoName: bestExisting.repoName,
      stackRoot: bestExisting.stackRoot,
      type: 'overlapExisting',
    };
  }
  if (bestInForm) {
    return {
      sourceRoot: bestInForm.sourceRoot,
      stackRoot: bestInForm.stackRoot,
      type: 'overlap',
    };
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

  return rows.map(({stackRoot}, index) =>
    deriveWarning(stackRoot, index, rows, normExisting)
  );
}
