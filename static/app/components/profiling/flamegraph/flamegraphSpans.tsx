import type {CSSProperties} from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {SpansContextMenu} from 'sentry/components/profiling/flamegraph/flamegraphSpansContextMenu';
import {t} from 'sentry/locale';
import type {RequestState} from 'sentry/types/core';
import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {useCanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphSearch';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {
  getConfigViewTranslationBetweenVectors,
  getPhysicalSpacePositionFromOffset,
} from 'sentry/utils/profiling/gl/utils';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {SpanChartRenderer2D} from 'sentry/utils/profiling/renderers/spansRenderer';
import {SpansTextRenderer} from 'sentry/utils/profiling/renderers/spansTextRenderer';
import type {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useDrawHoveredBorderEffect} from './interactions/useDrawHoveredBorderEffect';
import {useDrawSelectedBorderEffect} from './interactions/useDrawSelectedBorderEffect';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';
import {
  CollapsibleTimelineLoadingIndicator,
  CollapsibleTimelineMessage,
} from './collapsibleTimeline';
import {FlamegraphSpanTooltip} from './flamegraphSpanTooltip';

interface FlamegraphSpansProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  setSpansCanvasRef: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
  spanChart: SpanChart;
  spansCanvas: FlamegraphCanvas | null;
  spansCanvasRef: HTMLCanvasElement | null;
  spansRequestState: RequestState<any>;
  spansView: CanvasView<SpanChart> | null;
}

export function FlamegraphSpans({
  spanChart,
  canvasPoolManager,
  canvasBounds,
  spansView,
  spansCanvas,
  spansCanvasRef,
  setSpansCanvasRef,
  spansRequestState,
}: FlamegraphSpansProps) {
  const location = useLocation();
  const organization = useOrganization();
  const flamegraphTheme = useFlamegraphTheme();
  const flamegraphSearch = useFlamegraphSearch();
  const scheduler = useCanvasScheduler(canvasPoolManager);
  const pageFilters = usePageFilters();

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const selectedSpansRef = useRef<SpanChartNode[] | null>(null);

  const spansRenderer = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }

    return new SpanChartRenderer2D(spansCanvasRef, spanChart, flamegraphTheme);
  }, [spansCanvasRef, spanChart, flamegraphTheme]);

  const spansTextRenderer = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }

    return new SpansTextRenderer(spansCanvasRef, flamegraphTheme, spanChart);
  }, [spansCanvasRef, spanChart, flamegraphTheme]);

  const selectedSpanRenderer = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }

    return new SelectedFrameRenderer(spansCanvasRef);
  }, [spansCanvasRef]);

  const hoveredNode: SpanChartNode | null = useMemo(() => {
    if (!configSpaceCursor || !spansRenderer) {
      return null;
    }
    return spansRenderer.findHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, spansRenderer]);

  const hoveredNodeOnContextMenuOpen = useRef<SpanChartNode | null>(null);
  const contextMenuState = useContextMenu({container: spansCanvasRef});

  const handleContextMenuOpen = useCallback(
    (event: React.MouseEvent) => {
      hoveredNodeOnContextMenuOpen.current = hoveredNode;
      if (hoveredNode) {
        contextMenuState.handleContextMenu(event);
      }
    },
    [contextMenuState, hoveredNode]
  );

  useEffect(() => {
    if (!spansRenderer) {
      return;
    }
    spansRenderer.setSearchResults(
      flamegraphSearch.query,
      flamegraphSearch.results.spans
    );
  }, [spansRenderer, flamegraphSearch.query, flamegraphSearch.results.spans]);

  useEffect(() => {
    if (!spansCanvas || !spansView || !spansRenderer || !spansTextRenderer) {
      return undefined;
    }

    if (spansRequestState.type !== 'resolved') {
      return undefined;
    }
    const clearCanvas = () => {
      spansTextRenderer.context.clearRect(
        0,
        0,
        spansTextRenderer.canvas.width,
        spansTextRenderer.canvas.height
      );
    };

    const drawSpans = () => {
      spansRenderer.draw(
        spansView.toOriginConfigView(spansView.configView),
        spansView.fromTransformedConfigView(spansCanvas.physicalSpace)
      );
    };

    const drawText = () => {
      spansTextRenderer.draw(
        spansView.toOriginConfigView(spansView.configView),
        spansView.fromTransformedConfigView(spansCanvas.physicalSpace),
        flamegraphSearch.results.spans
      );
    };

    scheduler.registerBeforeFrameCallback(clearCanvas);
    scheduler.registerBeforeFrameCallback(drawSpans);
    scheduler.registerAfterFrameCallback(drawText);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawSpans);
      scheduler.unregisterBeforeFrameCallback(clearCanvas);
      scheduler.unregisterAfterFrameCallback(drawText);
    };
  }, [
    spansCanvas,
    spansRenderer,
    scheduler,
    spansView,
    spansTextRenderer,
    flamegraphSearch.results.spans,
    spansRequestState.type,
  ]);

  // When spans render, check for span_id presence in qs.
  // If it is present, highlight the span and zoom to it. This allows
  // us to link to specific spans via id without knowing their exact
  // without knowing their exact position in the view.
  useEffect(() => {
    if (!spansView || !spanChart || !spanChart.spans.length) {
      return;
    }

    const span_id = qs.parse(window.location.search).spanId;
    if (!span_id) {
      return;
    }

    const span = spanChart.spans.find(s => {
      if ('span_id' in s.node.span && s.node.span.span_id === span_id) {
        return true;
      }
      if ('event_id' in s.node.span && s.node.span.event_id === span_id) {
        return true;
      }
      return false;
    });

    if (!span) {
      return;
    }

    selectedSpansRef.current = [span];
    canvasPoolManager.dispatch('highlight span', [span ? [span] : null, 'selected']);
    canvasPoolManager.dispatch('zoom at span', [span, 'exact']);
  }, [canvasPoolManager, spansView, spanChart]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!spansCanvas || !spansView || !startInteractionVector) {
        return;
      }

      const configDelta = getConfigViewTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        startInteractionVector,
        spansView,
        spansCanvas
      );

      if (!configDelta) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [configDelta, spansView]);
      setStartInteractionVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [spansCanvas, spansView, startInteractionVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!spansCanvas || !spansView) {
        return;
      }

      const configSpaceMouse = spansView.getTransformedConfigViewCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        spansCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startInteractionVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [spansCanvas, spansView, onMouseDrag, startInteractionVector]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  const onWheelCenterZoom = useWheelCenterZoom(spansCanvas, spansView, canvasPoolManager);
  const onCanvasScroll = useCanvasScroll(spansCanvas, spansView, canvasPoolManager);

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: spansCanvasRef,
  });

  useDrawSelectedBorderEffect({
    scheduler,
    selectedRef: selectedSpansRef,
    canvas: spansCanvas,
    view: spansView,
    eventKey: 'highlight span',
    theme: flamegraphTheme,
    renderer: selectedSpanRenderer,
  });

  useDrawHoveredBorderEffect({
    scheduler,
    hoveredNode,
    canvas: spansCanvas,
    view: spansView,
    theme: flamegraphTheme,
    renderer: selectedSpanRenderer,
  });

  useInteractionViewCheckPoint({
    view: spansView,
    lastInteraction,
  });

  useEffect(() => {
    window.addEventListener('mouseup', onMinimapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMinimapCanvasMouseUp);
    };
  }, [onMinimapCanvasMouseUp]);

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartInteractionVector(null);
    setLastInteraction(null);
  }, []);

  const onCanvasMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    setLastInteraction('click');
    setStartInteractionVector(
      getPhysicalSpacePositionFromOffset(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY)
    );
  }, []);

  const onCanvasMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!spansView) {
        return;
      }

      if (!configSpaceCursor) {
        setLastInteraction(null);
        setStartInteractionVector(null);
        return;
      }

      // Only dispatch the zoom action if the new clicked node is not the same as the old selected node.
      // This essentially tracks double click action on a rectangle
      if (lastInteraction === 'click') {
        if (
          hoveredNode &&
          selectedSpansRef.current?.length === 1 &&
          selectedSpansRef.current[0] === hoveredNode
        ) {
          selectedSpansRef.current = [hoveredNode];
          // If double click is fired on a node, then zoom into it
          canvasPoolManager.dispatch('set config view', [
            new Rect(hoveredNode.start, hoveredNode.depth, hoveredNode.duration, 1),
            spansView,
          ]);
        }

        canvasPoolManager.dispatch('highlight span', [
          hoveredNode ? [hoveredNode] : null,
          'selected',
        ]);
      }

      setLastInteraction(null);
      setStartInteractionVector(null);
    },
    [configSpaceCursor, hoveredNode, spansView, canvasPoolManager, lastInteraction]
  );

  // When a user click anywhere outside the spans, clear cursor and selected node
  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (!spansCanvasRef || spansCanvasRef.contains(evt.target as Node)) {
        return;
      }
      canvasPoolManager.dispatch('highlight span', [null, 'selected']);
      setConfigSpaceCursor(null);
    };

    document.addEventListener('click', onClickOutside);

    return () => {
      document.removeEventListener('click', onClickOutside);
    };
  });

  const onCopyDescription = useCallback(() => {
    const value = hoveredNodeOnContextMenuOpen.current?.node.span.description ?? '';
    if (!value) {
      addErrorMessage(t('Event description value is empty.'));
      return;
    }

    navigator.clipboard
      .writeText(value)
      .then(() => {
        addSuccessMessage(t('Description copied to clipboard'));
      })
      .catch(() => {
        addErrorMessage(t('Failed to copy description to clipboard'));
      });
  }, [hoveredNodeOnContextMenuOpen]);

  const onCopyOperation = useCallback(() => {
    const value = hoveredNodeOnContextMenuOpen.current?.node.span.op ?? '';
    if (!value) {
      addErrorMessage(t('Event operation value is empty.'));
      return;
    }

    navigator.clipboard
      .writeText(value)
      .then(() => {
        addSuccessMessage(t('Operation copied to clipboard'));
      })
      .catch(() => {
        addErrorMessage(t('Failed to copy operation to clipboard'));
      });
  }, [hoveredNodeOnContextMenuOpen]);

  const onCopyEventId = useCallback(() => {
    const value =
      hoveredNodeOnContextMenuOpen.current?.node.span.event_id ??
      hoveredNodeOnContextMenuOpen.current?.node.span.span_id ??
      '';
    if (!value) {
      addErrorMessage(t('Event ID value is empty.'));
      return;
    }

    navigator.clipboard
      .writeText(value)
      .then(() => {
        addSuccessMessage(t('Event ID copied to clipboard'));
      })
      .catch(() => {
        addErrorMessage(t('Failed to copy event ID to clipboard'));
      });
  }, [hoveredNodeOnContextMenuOpen]);

  const onOpenInTraceView = useCallback(() => {
    const node = hoveredNodeOnContextMenuOpen.current?.node;
    if (!node) {
      addErrorMessage(t('No event ID or span ID found'));
      return;
    }

    const nodePath: Record<string, string> = {};

    if (node.span.op === 'transaction' && node.span.event_id) {
      // If the user clicks on a transaction, we can directly use the event_id
      nodePath.eventId = node.span.event_id;
    } else if (node.span.span_id) {
      // If the user clicks on a span, we need to traverse up the tree to find the transaction so that
      // the trace view knows which transaction to load and what span to point to.
      nodePath.spanId = node.span.span_id;
      let parent = node.parent;
      while (parent) {
        if (parent.span.op === 'transaction' && parent.span.event_id) {
          nodePath.eventId = parent.span.event_id;
          break;
        }
        parent = parent.parent;
      }
    }

    const link = getTraceDetailsUrl({
      traceSlug: node.span.trace_id,
      dateSelection: normalizeDateTimeParams(pageFilters.selection.datetime),
      location,
      organization,
      timestamp: node.span.timestamp,
      source: TraceViewSources.PROFILING_FLAMEGRAPH,
      ...nodePath,
    });

    window.open(
      `${link.pathname}?${qs.stringify(link.query ?? {})}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, [
    pageFilters.selection.datetime,
    hoveredNodeOnContextMenuOpen,
    location,
    organization,
  ]);

  return (
    <Fragment>
      <Canvas
        ref={setSpansCanvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onMouseUp={onCanvasMouseUp}
        onMouseDown={onCanvasMouseDown}
        onContextMenu={handleContextMenuOpen}
        cursor={lastInteraction === 'pan' ? 'grabbing' : 'default'}
      />
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {spansRequestState.type === 'loading' || spansRequestState.type === 'initial' ? (
        <CollapsibleTimelineLoadingIndicator />
      ) : spansRequestState.type === 'errored' ? (
        <CollapsibleTimelineMessage>
          {t('No associated transaction found')}
        </CollapsibleTimelineMessage>
      ) : spansRequestState.type === 'resolved' && spanChart.spans.length < 1 ? (
        <CollapsibleTimelineMessage>
          {t('Transaction has no spans')}
        </CollapsibleTimelineMessage>
      ) : null}

      <SpansContextMenu
        contextMenu={contextMenuState}
        hoveredNode={hoveredNodeOnContextMenuOpen.current}
        onCopyDescription={onCopyDescription}
        onCopyOperation={onCopyOperation}
        onCopyEventId={onCopyEventId}
        onOpenInTraceView={onOpenInTraceView}
      />

      {hoveredNode && spansRenderer && configSpaceCursor && spansCanvas && spansView ? (
        <FlamegraphSpanTooltip
          spanChart={spanChart}
          configSpaceCursor={configSpaceCursor}
          spansCanvas={spansCanvas}
          spansView={spansView}
          spansRenderer={spansRenderer}
          hoveredNode={hoveredNode}
          canvasBounds={canvasBounds}
        />
      ) : null}
    </Fragment>
  );
}

const Canvas = styled('canvas')<{cursor?: CSSProperties['cursor']}>`
  width: 100%;
  height: calc(100% - 20px);
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
  cursor: ${p => p.cursor};
`;
