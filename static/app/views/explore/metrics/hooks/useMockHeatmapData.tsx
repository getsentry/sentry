/**
 * TEMPORARY — experiment only, to be removed before merge.
 *
 * Simulates what a multi-dimension event-timeseries response would look like if
 * the endpoint returned two aggregates simultaneously — count() and avg() — and
 * we used both as the modes of a bimodal Gaussian heat distribution along the Y
 * axis.
 *
 * Design:
 *  - Timestamps are taken from whatever real data is already loaded; if the
 *    chart is empty we synthesise 48 × 30-min buckets so something always renders.
 *  - count() traces a lower-register oscillation (~20-40 % of Y range).
 *  - avg()   traces an upper-register oscillation (~65-85 % of Y range).
 *  - For every (time, y-bucket) cell the heat value is the sum of two Gaussians
 *    centred at the count() and avg() values for that timestamp, giving a soft
 *    exponential fall-off that never dips below y = 0.
 *  - The result is normalised to the 0-10 integer scale that ECharts / VisualMap
 *    already expect.
 */
import {useMemo} from 'react';

import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

// ─── constants ────────────────────────────────────────────────────────────────

const NUM_Y_BUCKETS = 10;
const Y_MIN = 0;
const Y_MAX = 1000;
// ~16 % of range → FWHM ≈ 3.8 buckets, so each mode bleeds across ~4 buckets
// and the two modes share meaningful heat in the region between them.
const SIGMA = 160;
// Cells below this fraction of the global peak are emitted as 0 (transparent).
const NOISE_FLOOR_FRACTION = 0.03;
// Fixed 30-min bucket size. Real timestamps are snapped to this grid so the
// cell width is always consistent regardless of the underlying query interval.
const BUCKET_MS = 30 * 60_000;
// Show the last 24 hours (48 × 30-min buckets).
const NUM_TIME_BUCKETS = 48;

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Deterministic per-index noise — no Math.random so values are stable across renders. */
function noise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x); // 0 .. 1
}

function gaussian(y: number, mu: number, sigma: number): number {
  const z = (y - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface MockHeatmapData {
  /** Flat ECharts heatmap triples: [xIndex, yBucketIndex, intensity 0-10] */
  data: Array<[number, number, number]>;
  maxVal: number;
  minVal: number;
  timestamps: number[];
  yLabels: string[];
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useMockHeatmapData(
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>
): MockHeatmapData {
  return useMemo(() => {
    // ── Step 1: timestamps ──────────────────────────────────────────────────
    // Snap the latest real timestamp (or now) to a 30-min boundary and build
    // a fixed grid of NUM_TIME_BUCKETS buckets working backwards from there.
    // This gives consistent cell widths regardless of the query interval.
    const realTimestamps = Object.values(timeseriesResult.data).flatMap(series =>
      series.flatMap(s => s.values.map(v => v.timestamp))
    );

    const latestMs = realTimestamps.length > 0 ? Math.max(...realTimestamps) : Date.now();
    const gridEnd = Math.floor(latestMs / BUCKET_MS) * BUCKET_MS;

    const timestamps = Array.from(
      {length: NUM_TIME_BUCKETS},
      (_, i) => gridEnd - (NUM_TIME_BUCKETS - 1 - i) * BUCKET_MS
    );

    const N = timestamps.length;
    const range = Y_MAX - Y_MIN;
    // Minimum safe centre distance from the bottom edge so the falloff never
    // produces meaningful heat below Y_MIN = 0.
    const minCenter = Y_MIN + SIGMA * 2;

    // ── Step 2: mock count() and avg() centre tracks + per-timestamp amplitudes ─
    //
    // count() — lower band, 2.5 cycles over the window.
    // avg()   — upper band, 1.7 cycles, different phase.
    //
    // Each mode also has an independent slowly-varying amplitude (0.25 – 1.0) so
    // the peak intensity within a mode is not always maxed out — sometimes a mode
    // is prominent, sometimes barely a ripple.

    const countCenters: number[] = timestamps.map((_, i) => {
      const t = i / Math.max(N - 1, 1);
      const base = 280 + 130 * Math.sin(2 * Math.PI * t * 2.5);
      const jitter = 25 * (noise(i * 3 + 7) - 0.5);
      return Math.max(minCenter, base + jitter);
    });

    const avgCenters: number[] = timestamps.map((_, i) => {
      const t = i / Math.max(N - 1, 1);
      const base = 720 + 120 * Math.cos(2 * Math.PI * t * 1.7 + 1.1);
      const jitter = 30 * (noise(i * 11 + 53) - 0.5);
      return Math.max(minCenter, Math.min(Y_MAX - SIGMA, base + jitter));
    });

    // Amplitude: narrow range (0.65 – 1.0) so intensity within each mode varies
    // subtly over time without creating visible voids that read as X-axis modes.
    const countAmps: number[] = timestamps.map((_, i) => {
      const t = i / Math.max(N - 1, 1);
      return 0.65 + 0.35 * Math.abs(Math.sin(Math.PI * t * 3.1 + 0.4));
    });

    const avgAmps: number[] = timestamps.map((_, i) => {
      const t = i / Math.max(N - 1, 1);
      return 0.65 + 0.35 * Math.abs(Math.cos(Math.PI * t * 2.3 + 1.8));
    });

    // ── Step 3: bimodal Gaussian heat field ──────────────────────────────────

    // rawHeat[ti][yi]
    const rawHeat: number[][] = Array.from({length: N}, () =>
      new Array(NUM_Y_BUCKETS).fill(0)
    );
    let globalMax = 0;

    for (let ti = 0; ti < N; ti++) {
      for (let yi = 0; yi < NUM_Y_BUCKETS; yi++) {
        const yCenter = Y_MIN + ((yi + 0.5) / NUM_Y_BUCKETS) * range;
        const heat =
          countAmps[ti]! * gaussian(yCenter, countCenters[ti]!, SIGMA) +
          avgAmps[ti]! * gaussian(yCenter, avgCenters[ti]!, SIGMA);
        rawHeat[ti]![yi] = heat;
        if (heat > globalMax) {
          globalMax = heat;
        }
      }
    }

    // ── Step 4: normalise to 0-10 integer scale ───────────────────────────────
    // Emit every cell so the tooltip target exists everywhere; cells below the
    // noise floor become intensity 0 (transparent via VisualMap).

    const data: Array<[number, number, number]> = [];
    const noiseFloor = globalMax * NOISE_FLOOR_FRACTION;

    for (let yi = 0; yi < NUM_Y_BUCKETS; yi++) {
      for (let ti = 0; ti < N; ti++) {
        const raw = rawHeat[ti]![yi]!;
        const intensity =
          raw > noiseFloor ? Math.max(1, Math.round((raw / globalMax) * 10)) : 0;
        data.push([ti, yi, intensity]);
      }
    }

    // ── Step 5: Y-axis labels (bucket midpoints) ──────────────────────────────

    const yLabels = Array.from({length: NUM_Y_BUCKETS}, (_, i) => {
      const val = Y_MIN + ((i + 0.5) / NUM_Y_BUCKETS) * range;
      return formatAxisValue(val);
    });

    return {data, timestamps, yLabels, minVal: Y_MIN, maxVal: Y_MAX};
  }, [timeseriesResult.data]);
}
