import {useCallback, useEffect, useRef, useState} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';

const HIGHLIGHT_COLOR = 'rgba(130, 180, 255, 0.45)';
const HIGHLIGHT_BORDER_COLOR = 'rgba(80, 140, 240, 0.9)';

interface UseInspectModeReturn {
  /**
   * Clear the selected element (e.g., when the modal is closed).
   */
  clearSelectedElement: () => void;
  /**
   * Disable inspect mode: remove listeners, clear highlight, optionally resume playback.
   */
  disableInspect: () => void;
  /**
   * Enable inspect mode: pause replay, attach iframe listeners, show hover highlight.
   */
  enableInspect: () => void;
  /**
   * The element the user hovered over (for preview purposes).
   */
  hoveredElement: HTMLElement | null;
  /**
   * Whether inspect mode is currently active.
   */
  isInspecting: boolean;
  /**
   * The element the user clicked on. When non-null, the modal should be shown.
   */
  selectedElement: HTMLElement | null;
}

export default function useInspectMode(): UseInspectModeReturn {
  const {getIframe, isPlaying, togglePlayPause, isVideoReplay} = useReplayContext();

  const [isInspecting, setIsInspecting] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);

  // Track whether replay was playing before entering inspect mode, so we can resume
  const wasPlayingRef = useRef(false);

  // Single reusable canvas for hover highlight (avoids create/destroy per hover)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // RAF handle for throttled highlight updates
  const rafRef = useRef<number | null>(null);

  // Track the current hovered element for RAF callback
  const pendingTargetRef = useRef<HTMLElement | null>(null);

  const drawHighlight = useCallback(
    (element: HTMLElement | null) => {
      const iframe = getIframe();
      if (!iframe) {
        return;
      }

      let canvas = canvasRef.current;
      const wrapper = iframe.parentElement;

      if (!element) {
        // Clear the highlight
        if (canvas && wrapper?.contains(canvas)) {
          wrapper.removeChild(canvas);
        }
        canvasRef.current = null;
        return;
      }

      // Create canvas if needed
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.setAttribute(
          'style',
          'position:absolute; pointer-events:none; z-index:1;'
        );
        canvasRef.current = canvas;
      }

      // Size canvas to match iframe
      canvas.width = Number(iframe.width) || iframe.clientWidth;
      canvas.height = Number(iframe.height) || iframe.clientHeight;

      // Draw the highlight
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const rect = element.getBoundingClientRect();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fill
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);

      // Border
      ctx.strokeStyle = HIGHLIGHT_BORDER_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);

      // Tooltip showing tag name
      const label =
        element.getAttribute('data-sentry-component') ||
        `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`;
      ctx.font = '12px monospace';
      const textMetrics = ctx.measureText(label);
      const textPadding = 4;
      const textHeight = 16;
      const tooltipX = rect.left;
      const tooltipY =
        rect.top > textHeight + textPadding * 2
          ? rect.top - textHeight - textPadding * 2
          : rect.bottom;

      ctx.fillStyle = 'rgba(30, 30, 30, 0.85)';
      ctx.fillRect(
        tooltipX,
        tooltipY,
        textMetrics.width + textPadding * 2,
        textHeight + textPadding
      );
      ctx.fillStyle = 'white';
      ctx.fillText(label, tooltipX + textPadding, tooltipY + textHeight);

      // Insert canvas into wrapper (before iframe, same as existing highlight system)
      if (wrapper && !wrapper.contains(canvas)) {
        wrapper.insertBefore(canvas, iframe);
      }
    },
    [getIframe]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName === 'HTML' || target.tagName === 'BODY') {
        pendingTargetRef.current = null;
        setHoveredElement(null);
        drawHighlight(null);
        return;
      }

      pendingTargetRef.current = target;

      // Throttle redraws with RAF
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const pendingTarget = pendingTargetRef.current;
          setHoveredElement(pendingTarget);
          drawHighlight(pendingTarget);
        });
      }
    },
    [drawHighlight]
  );

  const handleClick = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement | null;
    if (!target || target.tagName === 'HTML' || target.tagName === 'BODY') {
      return;
    }

    setSelectedElement(target);
  }, []);

  const cleanup = useCallback(() => {
    // Remove event listeners from iframe
    const iframe = getIframe();
    const doc = iframe?.contentDocument;
    if (doc) {
      doc.removeEventListener('mousemove', handleMouseMove);
      doc.removeEventListener('click', handleClick, true);
    }

    // Cancel pending RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Remove highlight canvas
    drawHighlight(null);

    setHoveredElement(null);
  }, [getIframe, handleMouseMove, handleClick, drawHighlight]);

  const enableInspect = useCallback(() => {
    if (isVideoReplay) {
      return; // Inspect mode not supported for video replays
    }

    const iframe = getIframe();
    const doc = iframe?.contentDocument;
    if (!doc) {
      return;
    }

    // Pause replay if playing
    wasPlayingRef.current = isPlaying;
    if (isPlaying) {
      togglePlayPause(false);
    }

    // Attach listeners to iframe's contentDocument
    doc.addEventListener('mousemove', handleMouseMove);
    doc.addEventListener('click', handleClick, true); // capture phase to beat rrweb

    setIsInspecting(true);
  }, [
    getIframe,
    isPlaying,
    isVideoReplay,
    togglePlayPause,
    handleMouseMove,
    handleClick,
  ]);

  const disableInspect = useCallback(() => {
    cleanup();
    setIsInspecting(false);
    setSelectedElement(null);

    // Resume playback if it was playing before inspect mode
    if (wasPlayingRef.current) {
      togglePlayPause(true);
      wasPlayingRef.current = false;
    }
  }, [cleanup, togglePlayPause]);

  const clearSelectedElement = useCallback(() => {
    setSelectedElement(null);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isInspecting,
    hoveredElement,
    selectedElement,
    enableInspect,
    disableInspect,
    clearSelectedElement,
  };
}
