import {normalizeRoot} from './normalization';
import type {PathMappingValue} from './type';

export type PathMappingWarning =
  | {type: 'catchAll'}
  | {sourceRoot: string; stackRoot: string; type: 'overlap'};

/**
 * Derives one optional warning per entry from the full list state.
 *
 * - catch-all: this row's stackRoot is empty, so it matches every path.
 * - overlap: another non-empty row's stackRoot starts with (or equals) this
 *   row's stackRoot. The longer root is evaluated first and wins for paths it
 *   covers; this row still applies to the rest. For exact duplicates, one of
 *   them will never apply.
 *
 * Empty stackRoots are excluded from the "other" set to avoid treating every
 * root as an overlap victim of a catch-all row.
 */
export function getPathMappingWarnings(
  values: PathMappingValue[]
): Array<PathMappingWarning | null> {
  const normalized = values.map(v => ({
    stackRoot: normalizeRoot(v.stackRoot),
    sourceRoot: normalizeRoot(v.sourceRoot),
  }));

  return normalized.map(({stackRoot}, index) => {
    if (stackRoot === '') {
      return {type: 'catchAll'};
    }

    // Find the longest other non-empty stackRoot that this one prefixes.
    let best: {sourceRoot: string; stackRoot: string} | null = null;
    for (let i = 0; i < normalized.length; i++) {
      if (i === index) {
        continue;
      }
      const other = normalized[i]!;
      if (other.stackRoot === '') {
        continue;
      }
      if (other.stackRoot.startsWith(stackRoot)) {
        if (!best || other.stackRoot.length > best.stackRoot.length) {
          best = other;
        }
      }
    }

    return best
      ? {sourceRoot: best.sourceRoot, stackRoot: best.stackRoot, type: 'overlap'}
      : null;
  });
}
