import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tn} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {DataFidelityAnnotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

// Four severity levels, mirroring Amir's design (severity by dropped volume, not
// exact counts). Thresholds are placeholders for the v0 demo and will be tuned.
const SEVERITY_THRESHOLDS: Array<{level: number; min: number}> = [
  {min: 100_000, level: 4},
  {min: 10_000, level: 3},
  {min: 1_000, level: 2},
  {min: 1, level: 1},
];

const STRIP_HEIGHT = 8;
const STRIP_GAP = 4;

function severityForCount(count: number): number {
  for (const {min, level} of SEVERITY_THRESHOLDS) {
    if (count >= min) {
      return level;
    }
  }
  return 0;
}

interface Bucket {
  annotations: DataFidelityAnnotation[];
  end: number;
  severity: number;
  start: number;
  total: number;
}

function groupIntoBuckets(annotations: DataFidelityAnnotation[]): Bucket[] {
  const byBucket = new Map<string, Bucket>();
  for (const annotation of annotations) {
    const key = `${annotation.start}-${annotation.end}`;
    const existing = byBucket.get(key);
    if (existing) {
      existing.total += annotation.droppedCount;
      existing.annotations.push(annotation);
      existing.severity = severityForCount(existing.total);
    } else {
      byBucket.set(key, {
        start: annotation.start,
        end: annotation.end,
        total: annotation.droppedCount,
        severity: severityForCount(annotation.droppedCount),
        annotations: [annotation],
      });
    }
  }
  return Array.from(byBucket.values());
}

interface DroppedDataOverlayProps {
  annotations: DataFidelityAnnotation[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
}

interface PlacedBucket extends Bucket {
  pixelLeft: number;
  pixelWidth: number;
}

/**
 * Renders a "Dropped Data" indicator strip just below the plotted data, aligned
 * to the chart's real plot area. We read pixel positions from the ECharts
 * instance (`convertToPixel` + the grid rect) so the segments line up with the
 * bars regardless of the y-axis label gutter. This is a v0 approximation of the
 * release-bubble treatment and lives entirely in the explore layer, so it can't
 * affect other charts.
 */
export function DroppedDataOverlay({annotations, chartRef}: DroppedDataOverlayProps) {
  const buckets = useMemo(() => groupIntoBuckets(annotations), [annotations]);

  // Recomputed pixel geometry read from the ECharts instance.
  const [placed, setPlaced] = useState<PlacedBucket[] | null>(null);
  const [plotBottom, setPlotBottom] = useState<number | null>(null);

  useEffect(() => {
    if (buckets.length === 0) {
      setPlaced(null);
      return undefined;
    }

    let raf = 0;

    const recompute = () => {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) {
        return;
      }

      // The grid's coordinate rect gives us the plot area's bottom + horizontal
      // extents. convertToPixel maps each bucket's timestamps to canvas pixels.
      let gridRect: {height: number; width: number; x: number; y: number} | null = null;
      try {
        const grid = (instance as any).getModel?.().getComponent?.('grid');
        gridRect = grid?.coordinateSystem?.getRect?.() ?? null;
      } catch {
        gridRect = null;
      }

      const next: PlacedBucket[] = [];
      for (const bucket of buckets) {
        const startPx = instance.convertToPixel({xAxisIndex: 0}, bucket.start);
        const endPx = instance.convertToPixel({xAxisIndex: 0}, bucket.end);
        if (typeof startPx !== 'number' || typeof endPx !== 'number') {
          continue;
        }
        const left = Math.min(startPx, endPx);
        const width = Math.max(Math.abs(endPx - startPx), 2);
        next.push({...bucket, pixelLeft: left, pixelWidth: width});
      }

      setPlaced(next);
      setPlotBottom(gridRect ? gridRect.y + gridRect.height : null);
    };

    // The instance may not be ready on first paint; retry on animation frames
    // and whenever the chart finishes rendering or the window resizes.
    const scheduleRecompute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    scheduleRecompute();

    const instance = chartRef.current?.getEchartsInstance();
    instance?.on('finished', scheduleRecompute);
    window.addEventListener('resize', scheduleRecompute);

    return () => {
      cancelAnimationFrame(raf);
      instance?.off('finished', scheduleRecompute);
      window.removeEventListener('resize', scheduleRecompute);
    };
  }, [buckets, chartRef]);

  if (!placed || placed.length === 0) {
    return null;
  }

  // Sit the strip just under the plotted area if we know where it ends,
  // otherwise fall back to near the chart bottom.
  const top = plotBottom === null ? undefined : plotBottom + STRIP_GAP;

  return (
    <OverlayLayer aria-hidden={false}>
      <StripRow style={top === undefined ? {bottom: 24} : {top}}>
        {placed.map(bucket => (
          <Tooltip
            key={`${bucket.start}-${bucket.end}`}
            title={<BucketTooltip bucket={bucket} />}
            skipWrapper
          >
            <Segment
              data-test-id="dropped-data-segment"
              severity={bucket.severity}
              style={{left: bucket.pixelLeft, width: bucket.pixelWidth}}
            />
          </Tooltip>
        ))}
      </StripRow>
    </OverlayLayer>
  );
}

function BucketTooltip({bucket}: {bucket: Bucket}) {
  return (
    <Flex direction="column" gap="xs" align="start">
      <Text size="xs" bold>
        {tn('%s event dropped', '%s events dropped', bucket.total)}
      </Text>
      {bucket.annotations.map((annotation, i) => (
        <Text key={i} size="xs" variant="muted">
          {`${annotation.label} — ${annotation.droppedCount.toLocaleString()}`}
        </Text>
      ))}
    </Flex>
  );
}

/**
 * Fallback used when we can't render the aligned overlay (or want a guaranteed
 * view of the payload): a plain list of the annotations. Ensures the API
 * response is always visible.
 */
export function DroppedDataList({annotations}: {annotations: DataFidelityAnnotation[]}) {
  const buckets = useMemo(() => groupIntoBuckets(annotations), [annotations]);
  if (buckets.length === 0) {
    return null;
  }
  const total = buckets.reduce((sum, b) => sum + b.total, 0);
  return (
    <Flex direction="column" gap="2xs" padding="xs sm">
      <Text size="xs" bold>
        {t('Dropped Data')} — {tn('%s event', '%s events', total)}
      </Text>
      {annotations.map((annotation, i) => (
        <Text key={i} size="xs" variant="muted">
          {`${annotation.label}: ${annotation.droppedCount.toLocaleString()} (${annotation.reason})`}
        </Text>
      ))}
    </Flex>
  );
}

const OverlayLayer = styled('div')`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

const StripRow = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  height: ${STRIP_HEIGHT}px;
`;

// Higher severity => more opaque red. Uses the danger graphics token so it
// tracks the theme rather than a hardcoded hex.
const SEVERITY_OPACITY: Record<number, number> = {
  1: 0.35,
  2: 0.55,
  3: 0.75,
  4: 1,
};

const Segment = styled('div')<{severity: number}>`
  position: absolute;
  top: 0;
  height: ${STRIP_HEIGHT}px;
  border-radius: 2px;
  pointer-events: auto;
  cursor: pointer;
  background: ${p => p.theme.tokens.graphics.danger.vibrant};
  opacity: ${p => SEVERITY_OPACITY[p.severity] ?? 0.55};

  &:hover {
    outline: 1px solid ${p => p.theme.tokens.graphics.danger.vibrant};
  }
`;
