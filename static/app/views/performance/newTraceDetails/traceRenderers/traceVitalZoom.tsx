import {clamp} from 'sentry/utils/number/clamp';
import type {TraceTimeCompression} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceTimeCompression';

const TIMESTAMP_ZOOM_RATIO = 0.5;

export type VitalZoomSession = {
  anchor: number;
  targetWidth: number;
  vital: string;
};

type ComputeVitalTimestampZoomOptions = {
  compression: TraceTimeCompression;
  minWidth: number;
  origin: number;
  session: VitalZoomSession | null;
  timestamp: number;
  traceWidth: number;
  viewWidth: number;
  vital: string;
};

type VitalTimestampZoom = {
  session: VitalZoomSession;
  shouldResetToFullTrace: boolean;
  space: [number, number];
};

/**
 * Next zoom window around a vital marker.
 *
 * Uses compressed (visual) time so collapsed gaps don't shift the marker.
 * Disabled compression is an identity mapping, so the same math works either way.
 *
 * Repeated clicks on the same vital keep the marker at a fixed viewport fraction
 * and zoom from the planned target width, not the in-flight animated width.
 * A different vital zooms back to the full trace first.
 */
export function computeVitalTimestampZoom({
  compression,
  minWidth,
  origin,
  session,
  timestamp,
  traceWidth,
  viewWidth,
  vital,
}: ComputeVitalTimestampZoomOptions): VitalTimestampZoom {
  const compressedTimestamp = compression.toCompressedOffset(timestamp);
  const compressedTraceStart = compression.toCompressedOffset(origin);
  const timestampInTrace = compressedTimestamp - compressedTraceStart;
  const compressedTraceWidth =
    compression.toCompressedOffset(origin + traceWidth) - compressedTraceStart;

  const isRepeat = session !== null && session.vital === vital;
  const anchor = isRepeat
    ? session.anchor
    : compressedTraceWidth > 0
      ? clamp(timestampInTrace / compressedTraceWidth, 0, 1)
      : 0.5;

  const baseWidth = isRepeat
    ? Math.min(viewWidth, session.targetWidth)
    : compressedTraceWidth;

  const targetWidth = Math.max(baseWidth * TIMESTAMP_ZOOM_RATIO, minWidth);

  const startInTrace = clamp(
    timestampInTrace - targetWidth * anchor,
    0,
    Math.max(compressedTraceWidth - targetWidth, 0)
  );

  const compressedStart = compressedTraceStart + startInTrace;
  const start = compression.toRealTimestamp(compressedStart);
  const end = compression.toRealTimestamp(compressedStart + targetWidth);

  return {
    session: {anchor, targetWidth, vital},
    shouldResetToFullTrace: session !== null && !isRepeat,
    space: [start, end - start],
  };
}
