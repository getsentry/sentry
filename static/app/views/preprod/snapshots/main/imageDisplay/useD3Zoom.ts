import {useCallback, useEffect, useRef, useState} from 'react';
import {select} from 'd3-selection';
import {zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform} from 'd3-zoom';

interface UseD3ZoomOptions {
  maxScale?: number;
  minScale?: number;
  onTransformChange?: (transform: ZoomTransform) => void;
}

interface UseD3ZoomReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  resetZoom: () => void;
  transform: ZoomTransform;
  zoomBehaviorRef: React.RefObject<ZoomBehavior<HTMLDivElement, unknown> | null>;
  zoomIn: () => void;
  zoomOut: () => void;
}

const ZOOM_STEP = 1.3;

export function useD3Zoom({
  minScale = 0.5,
  maxScale = 10,
  onTransformChange,
}: UseD3ZoomOptions = {}): UseD3ZoomReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([minScale, maxScale])
      .filter(event => {
        return (
          event.type === 'wheel' ||
          event.type === 'touchstart' ||
          (event.type === 'mousedown' && !event.button && !event.ctrlKey)
        );
      })
      .on('zoom', event => {
        setTransform(event.transform);
        onTransformChangeRef.current?.(event.transform);
      });

    zoomBehaviorRef.current = zoomBehavior;
    select(container).call(zoomBehavior);

    return () => {
      select(container).on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, [minScale, maxScale]);

  const zoomIn = useCallback(() => {
    const container = containerRef.current;
    const zb = zoomBehaviorRef.current;
    if (!container || !zb) {
      return;
    }
    zb.scaleBy(select(container), ZOOM_STEP);
  }, []);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    const zb = zoomBehaviorRef.current;
    if (!container || !zb) {
      return;
    }
    zb.scaleBy(select(container), 1 / ZOOM_STEP);
  }, []);

  const resetZoom = useCallback(() => {
    const container = containerRef.current;
    const zb = zoomBehaviorRef.current;
    if (!container || !zb) {
      return;
    }
    zb.transform(select(container), zoomIdentity);
  }, []);

  return {containerRef, transform, zoomIn, zoomOut, resetZoom, zoomBehaviorRef};
}

export function useSyncedD3Zoom(
  options: UseD3ZoomOptions = {}
): [UseD3ZoomReturn, UseD3ZoomReturn] {
  const isSyncing = useRef(false);
  const zoom1Refs = useRef<UseD3ZoomReturn>(null!);
  const zoom2Refs = useRef<UseD3ZoomReturn>(null!);

  function syncTo(targetRefs: React.RefObject<UseD3ZoomReturn>) {
    return (t: ZoomTransform) => {
      if (isSyncing.current) {
        return;
      }
      isSyncing.current = true;
      const container = targetRefs.current.containerRef.current;
      const zb = targetRefs.current.zoomBehaviorRef.current;
      if (container && zb) {
        select(container).call(zb.transform, t);
      }
      isSyncing.current = false;
    };
  }

  const zoom1 = useD3Zoom({...options, onTransformChange: syncTo(zoom2Refs)});
  const zoom2 = useD3Zoom({...options, onTransformChange: syncTo(zoom1Refs)});

  zoom1Refs.current = zoom1;
  zoom2Refs.current = zoom2;

  return [zoom1, zoom2];
}
