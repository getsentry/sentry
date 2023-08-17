import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {Button} from 'sentry/components/button';
import {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import {
  calculateScale,
  getDeepestNodeAtPoint,
  getHierarchyDimensions,
  useResizeCanvasObserver,
} from 'sentry/components/events/viewHierarchy/utils';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {getCenterScaleMatrixFromConfigPosition} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

const MIN_BORDER_SIZE = 20;
const MOUSE_DRAG_THRESHOLD = 3;

export interface ViewNode {
  node: ViewHierarchyWindow;
  rect: Rect;
}

type WireframeProps = {
  hierarchy: ViewHierarchyWindow[];
  onNodeSelect: (node?: ViewHierarchyWindow) => void;
  project: Project;
  selectedNode?: ViewHierarchyWindow;
};

function Wireframe({hierarchy, selectedNode, onNodeSelect, project}: WireframeProps) {
  const theme = useTheme();
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [overlayRef, setOverlayRef] = useState<HTMLCanvasElement | null>(null);
  const [zoomIn, setZoomIn] = useState<HTMLElement | null>(null);
  const [zoomOut, setZoomOut] = useState<HTMLElement | null>(null);

  const canvases = useMemo(() => {
    return canvasRef && overlayRef ? [canvasRef, overlayRef] : [];
  }, [canvasRef, overlayRef]);

  const canvasSize = useResizeCanvasObserver(canvases);

  const hierarchyData = useMemo(
    () =>
      getHierarchyDimensions(
        hierarchy,
        ['flutter', 'dart-flutter'].includes(project?.platform ?? '')
      ),
    [hierarchy, project.platform]
  );
  const nodeLookupMap = useMemo(() => {
    const map = new Map<ViewHierarchyWindow, ViewNode>();
    hierarchyData.nodes.forEach(node => {
      map.set(node.node, node);
    });
    return map;
  }, [hierarchyData.nodes]);

  const scale = useMemo(() => {
    return calculateScale(
      {width: canvasSize.width, height: canvasSize.height},
      {width: hierarchyData.maxWidth, height: hierarchyData.maxHeight},
      {
        x: MIN_BORDER_SIZE,
        y: MIN_BORDER_SIZE,
      }
    );
  }, [
    canvasSize.height,
    canvasSize.width,
    hierarchyData.maxHeight,
    hierarchyData.maxWidth,
  ]);

  const transformationMatrix = useMemo(() => {
    const xCenter = Math.abs(canvasSize.width - hierarchyData.maxWidth * scale) / 2;
    const yCenter = Math.abs(canvasSize.height - hierarchyData.maxHeight * scale) / 2;

    // prettier-ignore
    return mat3.fromValues(
      scale, 0, 0,
      0, scale, 0,
      xCenter, yCenter, 1
    );
  }, [
    canvasSize.height,
    canvasSize.width,
    hierarchyData.maxHeight,
    hierarchyData.maxWidth,
    scale,
  ]);

  const setupCanvasContext = useCallback(
    (context: CanvasRenderingContext2D, modelToView: mat3) => {
      context.resetTransform();
      context.clearRect(0, 0, canvasSize.width, canvasSize.height);

      context.setTransform(
        modelToView[0],
        modelToView[3],
        modelToView[1],
        modelToView[4],
        modelToView[6],
        modelToView[7]
      );
    },
    [canvasSize.height, canvasSize.width]
  );

  const drawOverlay = useCallback(
    (modelToView: mat3, selectedRect: Rect | null, hoverRect: Rect | null) => {
      const overlay = overlayRef?.getContext('2d');
      if (overlay) {
        setupCanvasContext(overlay, modelToView);
        overlay.fillStyle = theme.blue200;

        if (selectedRect) {
          overlay.fillRect(
            selectedRect.x,
            selectedRect.y,
            selectedRect.width,
            selectedRect.height
          );
        }

        if (hoverRect) {
          overlay.fillStyle = theme.blue100;
          overlay.fillRect(hoverRect.x, hoverRect.y, hoverRect.width, hoverRect.height);
        }
      }
    },
    [overlayRef, setupCanvasContext, theme.blue100, theme.blue200]
  );

  const drawViewHierarchy = useCallback(
    (modelToView: mat3) => {
      const canvas = canvasRef?.getContext('2d');
      if (canvas) {
        setupCanvasContext(canvas, modelToView);
        canvas.fillStyle = theme.gray100;
        canvas.strokeStyle = theme.gray300;

        for (let i = 0; i < hierarchyData.nodes.length; i++) {
          canvas.strokeRect(
            hierarchyData.nodes[i].rect.x,
            hierarchyData.nodes[i].rect.y,
            hierarchyData.nodes[i].rect.width,
            hierarchyData.nodes[i].rect.height
          );
          canvas.fillRect(
            hierarchyData.nodes[i].rect.x,
            hierarchyData.nodes[i].rect.y,
            hierarchyData.nodes[i].rect.width,
            hierarchyData.nodes[i].rect.height
          );
        }
      }
    },
    [canvasRef, setupCanvasContext, theme.gray100, theme.gray300, hierarchyData.nodes]
  );

  useEffect(() => {
    if (!canvasRef || !overlayRef || !zoomIn || !zoomOut) {
      return undefined;
    }

    let start: vec2 | null;
    let isDragging = false;
    const selectedRect: Rect | null =
      (selectedNode && nodeLookupMap.get(selectedNode)?.rect) ?? null;
    let hoveredRect: Rect | null = null;
    const currTransformationMatrix = mat3.clone(transformationMatrix);
    const lastMousePosition = vec2.create();

    const handleMouseDown = (e: MouseEvent) => {
      start = vec2.fromValues(e.offsetX, e.offsetY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (start) {
        const currPosition = vec2.fromValues(e.offsetX, e.offsetY);
        const delta = vec2.sub(vec2.create(), currPosition, start);

        // If the mouse hasn't moved significantly, then don't consider
        // this a drag. This prevents missed selections when the user
        // moves their mouse slightly when clicking
        const distance = vec2.len(delta);
        if (!isDragging && distance < MOUSE_DRAG_THRESHOLD) {
          return;
        }

        overlayRef.style.cursor = 'grabbing';
        isDragging = true;
        hoveredRect = null;

        // Delta needs to be scaled by the devicePixelRatio and how
        // much we've zoomed the image by to get an accurate translation
        vec2.scale(delta, delta, window.devicePixelRatio / transformationMatrix[0]);

        // Translate from the original matrix as a starting point
        mat3.translate(currTransformationMatrix, transformationMatrix, delta);
        drawViewHierarchy(currTransformationMatrix);
        drawOverlay(currTransformationMatrix, selectedRect, hoveredRect);
      } else {
        hoveredRect =
          getDeepestNodeAtPoint(
            hierarchyData.nodes,
            vec2.fromValues(e.offsetX, e.offsetY),
            currTransformationMatrix,
            window.devicePixelRatio
          )?.rect ?? null;
        drawOverlay(transformationMatrix, selectedRect, hoveredRect);
      }
      vec2.copy(lastMousePosition, vec2.fromValues(e.offsetX, e.offsetY));
      vec2.scale(lastMousePosition, lastMousePosition, window.devicePixelRatio);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        // The panning has ended, store its transformations into the original matrix
        mat3.copy(transformationMatrix, currTransformationMatrix);
      }
      start = null;
      overlayRef.style.cursor = 'pointer';
    };

    const handleMouseClick = (e: MouseEvent) => {
      if (!isDragging) {
        const clickedNode = getDeepestNodeAtPoint(
          hierarchyData.nodes,
          vec2.fromValues(e.offsetX, e.offsetY),
          transformationMatrix,
          window.devicePixelRatio
        );

        if (!clickedNode) {
          return;
        }

        drawOverlay(transformationMatrix, clickedNode?.rect ?? null, null);
        onNodeSelect(clickedNode?.node);
      }
      isDragging = false;
    };

    const handleZoom =
      (direction: 'in' | 'out', scalingFactor: number = 1.1, zoomOrigin?: vec2) =>
      () => {
        const newScale = direction === 'in' ? scalingFactor : 1 / scalingFactor;

        // Generate a scaling matrix that also accounts for the zoom origin
        // so when the scale is applied, the zoom origin stays in the same place
        // i.e. cursor position or center of the canvas
        const center = vec2.fromValues(canvasSize.width / 2, canvasSize.height / 2);
        const origin = zoomOrigin ?? center;
        const scaleMatrix = getCenterScaleMatrixFromConfigPosition(
          vec2.fromValues(newScale, newScale),
          origin
        );
        mat3.multiply(currTransformationMatrix, scaleMatrix, currTransformationMatrix);

        drawViewHierarchy(currTransformationMatrix);
        drawOverlay(currTransformationMatrix, selectedRect, hoveredRect);
        mat3.copy(transformationMatrix, currTransformationMatrix);
      };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? 'out' : 'in', 1.05, lastMousePosition)();
      }
    };

    const options: AddEventListenerOptions & EventListenerOptions = {passive: true};
    const onwheelOptions: AddEventListenerOptions & EventListenerOptions = {
      passive: false,
    };

    overlayRef.addEventListener('mousedown', handleMouseDown, options);
    overlayRef.addEventListener('mousemove', handleMouseMove, options);
    overlayRef.addEventListener('mouseup', handleMouseUp, options);
    overlayRef.addEventListener('click', handleMouseClick, options);

    zoomIn.addEventListener('click', handleZoom('in'), options);
    zoomOut.addEventListener('click', handleZoom('out'), options);
    overlayRef.addEventListener('wheel', handleWheel, onwheelOptions);

    drawViewHierarchy(transformationMatrix);
    drawOverlay(transformationMatrix, selectedRect, hoveredRect);

    return () => {
      overlayRef.removeEventListener('mousedown', handleMouseDown, options);
      overlayRef.removeEventListener('mousemove', handleMouseMove, options);
      overlayRef.removeEventListener('mouseup', handleMouseUp, options);
      overlayRef.removeEventListener('click', handleMouseClick, options);

      zoomIn.removeEventListener('click', handleZoom('in'), options);
      zoomOut.removeEventListener('click', handleZoom('out'), options);
      overlayRef.removeEventListener('wheel', handleWheel, onwheelOptions);
    };
  }, [
    transformationMatrix,
    canvasRef,
    scale,
    overlayRef,
    hierarchyData.nodes,
    onNodeSelect,
    drawViewHierarchy,
    drawOverlay,
    selectedNode,
    nodeLookupMap,
    zoomIn,
    zoomOut,
    canvasSize.width,
    canvasSize.height,
  ]);

  return (
    <Stack>
      <InteractionContainer>
        <Controls>
          <Button size="xs" ref={setZoomIn} aria-label={t('Zoom In on wireframe')}>
            <IconAdd size="xs" />
          </Button>
          <Button size="xs" ref={setZoomOut} aria-label={t('Zoom Out on wireframe')}>
            <IconSubtract size="xs" />
          </Button>
        </Controls>
        <InteractionOverlayCanvas
          data-test-id="view-hierarchy-wireframe-overlay"
          ref={r => setOverlayRef(r)}
        />
      </InteractionContainer>
      <WireframeCanvas
        data-test-id="view-hierarchy-wireframe"
        ref={r => setCanvasRef(r)}
      />
    </Stack>
  );
}

export {Wireframe};

const Stack = styled('div')`
  position: relative;
  height: 100%;
  width: 100%;
`;

const InteractionContainer = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  cursor: pointer;
`;

const Controls = styled('div')`
  position: absolute;
  top: ${space(2)};
  right: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const InteractionOverlayCanvas = styled('canvas')`
  width: 100%;
  height: 100%;
`;

const WireframeCanvas = styled('canvas')`
  background-color: ${p => p.theme.surface100};
  width: 100%;
  height: 100%;
`;
