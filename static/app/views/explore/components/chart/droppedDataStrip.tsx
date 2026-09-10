import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tn} from 'sentry/locale';
import type {DataFidelityAnnotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

// Four severity levels. Severity is conveyed by the number of stacked pills, NOT
// by color — this is the design the team converged on so the markers read as
// distinct from release chips (which use color) and don't imply a threshold.
// Thresholds are placeholders for v0 and will be tuned against real volume.
const SEVERITY_THRESHOLDS: Array<{level: number; min: number}> = [
  {min: 100_000, level: 4},
  {min: 10_000, level: 3},
  {min: 1_000, level: 2},
  {min: 1, level: 1},
];

const MAX_SEVERITY = 4;

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
  /** End of the chart time range, ms since epoch. */
  end: number;
  /** Start of the chart time range, ms since epoch. */
  start: number;
}

/**
 * Renders a "Dropped Data" indicator below the chart as a row of stacked pill
 * markers, one stack per time bucket. Severity (how much data was dropped in
 * that bucket) is shown by how many pills are stacked, from 1 to 4 — never by
 * color. This deliberately reads as a metaphor for dropped data (it sits below
 * the plot) and stays visually distinct from the colored release chips.
 *
 * Positioning is percentage-based off the chart's time range, so it lines up
 * with the plotted buckets without reaching into the ECharts instance.
 */
export function DroppedDataOverlay({annotations, start, end}: DroppedDataOverlayProps) {
  const buckets = useMemo(() => groupIntoBuckets(annotations), [annotations]);
  const range = end - start;

  if (range <= 0 || buckets.length === 0) {
    return null;
  }

  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

  return (
    <Wrapper>
      <Label>
        <LegendSwatch />
        <Text size="xs" variant="muted" bold>
          {t('Dropped Data')}
        </Text>
      </Label>
      <Track aria-label={t('Dropped data over time')}>
        {buckets.map(bucket => {
          const leftPct = ((bucket.start - start) / range) * 100;
          const widthPct = Math.max(((bucket.end - bucket.start) / range) * 100, 0.6);
          return (
            <Tooltip
              key={`${bucket.start}-${bucket.end}`}
              title={<BucketTooltip bucket={bucket} />}
              skipWrapper
            >
              <PillStack
                data-test-id="dropped-data-pills"
                style={{left: `${Math.max(leftPct, 0)}%`, width: `${widthPct}%`}}
              >
                {Array.from({length: bucket.severity}).map((_, row) => (
                  <Pill key={row} />
                ))}
              </PillStack>
            </Tooltip>
          );
        })}
      </Track>
      <Text size="xs" variant="muted">
        {tn('%s event dropped', '%s events dropped', total)}
      </Text>
    </Wrapper>
  );
}

function BucketTooltip({bucket}: {bucket: Bucket}) {
  return (
    <Stack gap="xs" align="start">
      <Text size="xs" bold>
        {tn('%s event dropped', '%s events dropped', bucket.total)}
      </Text>
      {bucket.annotations.map((annotation, i) => (
        <Text key={i} size="xs" variant="muted">
          {`${annotation.label} — ${annotation.droppedCount.toLocaleString()}`}
        </Text>
      ))}
    </Stack>
  );
}

const PILL_HEIGHT = 3;
const PILL_GAP = 2;
const TRACK_HEIGHT = MAX_SEVERITY * (PILL_HEIGHT + PILL_GAP);

const Wrapper = styled('div')`
  display: flex;
  align-items: flex-end;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
`;

const Label = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space['2xs']};
  flex-shrink: 0;
  padding-bottom: ${PILL_GAP}px;
`;

// A single pill so the label reads as the same mark used on the track.
const LegendSwatch = styled('div')`
  width: 10px;
  height: ${PILL_HEIGHT}px;
  border-radius: 2px;
  background: ${p => p.theme.tokens.graphics.danger.vibrant};
`;

const Track = styled('div')`
  position: relative;
  flex: 1;
  height: ${TRACK_HEIGHT}px;
  min-width: 0;
`;

// Each bucket's pills grow upward from the baseline, centered on the bucket.
const PillStack = styled('div')`
  position: absolute;
  bottom: 0;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: ${PILL_GAP}px;
  pointer-events: auto;
  cursor: pointer;

  &:hover > div {
    filter: brightness(1.15);
  }
`;

const Pill = styled('div')`
  width: 100%;
  min-width: 6px;
  height: ${PILL_HEIGHT}px;
  border-radius: 2px;
  background: ${p => p.theme.tokens.graphics.danger.vibrant};
`;
