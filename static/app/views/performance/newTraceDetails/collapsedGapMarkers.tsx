import {useCallback, useLayoutEffect, useSyncExternalStore} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';

import type {TraceTimeCompressionGap} from './traceRenderers/traceTimeCompression';
import type {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';

export function CollapsedGapMarkers({
  manager,
  scrollContainer,
}: {
  manager: VirtualizedViewManager;
  scrollContainer: HTMLElement | null;
}) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      manager.scheduler.on('time compression change', onChange);
      return () => manager.scheduler.off('time compression change', onChange);
    },
    [manager]
  );
  const getSnapshot = useCallback(() => manager.time_compression, [manager]);
  const compression = useSyncExternalStore(subscribe, getSnapshot);

  useLayoutEffect(() => {
    // Refresh label overlap positions after React has reconciled the marker refs.
    manager.draw();
  }, [manager, compression]);

  return compression.gaps.map((gap, index) => (
    <CollapsedGapMarker
      key={index}
      gap={gap}
      index={index}
      manager={manager}
      scrollContainer={scrollContainer}
    />
  ));
}

function CollapsedGapMarker({
  gap,
  index,
  manager,
  scrollContainer,
}: {
  gap: TraceTimeCompressionGap;
  index: number;
  manager: VirtualizedViewManager;
  scrollContainer: HTMLElement | null;
}) {
  const registerCollapsedGapMarkerRef = useCallback(
    (ref: HTMLDivElement | null) => {
      manager.registerCollapsedGapMarkerRef(ref, index, gap);
    },
    [gap, index, manager]
  );

  const durationLabel = formatTraceDuration(gap.duration);
  const onPillWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!scrollContainer) {
      return;
    }

    event.preventDefault();
    // oxlint-disable-next-line react/immutability
    scrollContainer.scrollTop += event.deltaY;
    scrollContainer.scrollLeft += event.deltaX;
  };

  return (
    <div
      ref={registerCollapsedGapMarkerRef}
      className="TraceCollapsedGapMarker"
      style={{pointerEvents: 'none'}}
    >
      <div className="TraceCollapsedGapMarkerBreak" />
      <Tooltip title={`Skipped ${durationLabel} inactive period`}>
        <div
          className="TraceCollapsedGapMarkerPill"
          style={{pointerEvents: 'auto'}}
          onWheel={onPillWheel}
        >
          {durationLabel}
        </div>
      </Tooltip>
    </div>
  );
}
