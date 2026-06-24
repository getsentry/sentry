/**
 * Heat map color scaling via histogram equalization.
 *
 * ## The problem this solves
 *
 * A heat map colors each cell by its Z value (here, a count of events in a
 * time/value bucket). To turn a Z value into a color we need to map it onto a
 * position in `[0, 1]` and let the palette interpolate. The obvious mappings —
 * linear (`z / zMax`) and logarithmic (`log1p(z) / log1p(zMax)`) — both fail on
 * the long-tailed distributions we actually see: a handful of huge buckets
 * stretch the scale so that everything else collapses into one or two colors.
 * Concretely, a cell of 1,000,000 and one of 18,000,000 map to nearly the same
 * position because, even in log space, both sit at the very top of the range
 * with almost no room between them.
 *
 * ## The approach: equalize by rank, not by magnitude
 *
 * Instead of mapping by *how big* a value is, we map by *what fraction of the
 * data is at or below it* — its empirical CDF (a.k.a. fractional rank, a.k.a.
 * histogram equalization). If a value is greater than 90% of all populated
 * cells, it sits at position 0.9 regardless of whether the spread is 1→100 or
 * 1→18,000,000. This spreads the data evenly across the whole palette, so two
 * values in different percentiles always get visibly different colors.
 *
 * ## How it's computed
 *
 *   position(z) = (number of populated cells with value <= z) / (number of
 *                 populated cells)
 *
 * We sort the populated (non-zero, non-null) values once up front, then each
 * lookup is a binary search — O(n log n) to build, O(log n) per cell.
 *
 * ## Why only non-zero, non-null values?
 *
 * Empty buckets (`z === null`) and true-zero buckets are rendered transparent
 * by a separate piecewise `visualMap` that keys off position `0`. So this scale
 * deliberately maps any `z <= 0` (or null) to position `0` and equalizes only
 * over the populated cells. That also means the *lowest* populated value maps to
 * a small but non-zero position (`>= 1/n`), keeping it opaque and visible rather
 * than collapsing into the transparent "empty" bucket.
 *
 * ## Trade-off / escape hatch
 *
 * Pure equalization can *exaggerate* tiny differences when the data is nearly
 * uniform (adjacent ranks get pushed apart even if their values are almost
 * equal). For our long-tailed count data that's a minor, secondary concern, so
 * we keep the simple version. If a future chart looks too flat or misleading,
 * the documented next step is to blend this rank position with a `log1p`
 * magnitude position (Datadog's "linear weighting of the two") behind a weight
 * constant — but we intentionally do not build that yet.
 */

interface HeatMapColorScale {
  /**
   * Maps a raw Z value to a color position in `[0, 1]`, where `0` is the bottom
   * of the palette (and, for `z <= 0`, transparent) and `1` is the top. Returns
   * `0` for non-positive values and when there is no populated data to equalize
   * over.
   */
  toColorPosition(z: number): number;
}

/**
 * Builds a {@link HeatMapColorScale} from a series' Z values. Pass the raw cell
 * values (`null` for empty buckets); the scale equalizes over the positive ones.
 */
export function createHeatMapColorScale(
  values: ReadonlyArray<number | null>
): HeatMapColorScale {
  // Keep only populated cells: drop nulls (empty buckets) and non-positive
  // counts, which we render transparent rather than color. Sort ascending so we
  // can answer "how many values are <= z?" with a binary search.
  const sorted = values
    .filter((value): value is number => value !== null && value > 0)
    .sort((a, b) => a - b);

  const total = sorted.length;

  return {
    toColorPosition(z: number): number {
      // Non-positive values (and the empty-bucket case below) sit at position 0,
      // where the piecewise visualMap makes them transparent.
      if (z <= 0) {
        return 0;
      }

      // No populated cells to equalize against — everything is position 0.
      if (total === 0) {
        return 0;
      }

      // Count of populated values <= z, found via upper-bound binary search.
      // Using "<= z" (rather than "< z") means tied values share the same
      // position: the top of their rank group.
      const countAtOrBelow = upperBound(sorted, z);

      return countAtOrBelow / total;
    },
  };
}

/**
 * Returns the number of elements in the ascending-sorted `sorted` that are
 * `<= target` — i.e. the index of the first element strictly greater than
 * `target`. Plain binary search, no dependencies.
 */
function upperBound(sorted: readonly number[], target: number): number {
  let low = 0;
  let high = sorted.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    // `mid` is always in range, so `value` is never undefined; the guard just
    // satisfies `noUncheckedIndexedAccess` without a non-null assertion.
    const value = sorted[mid];
    if (value !== undefined && value <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}
