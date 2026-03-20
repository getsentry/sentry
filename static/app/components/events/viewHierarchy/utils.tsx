import {useLayoutEffect, useState} from 'react';
import {mat3, vec2} from 'gl-matrix';

import type {
  ViewHierarchyNodeField,
  ViewHierarchyWindow,
} from 'sentry/components/events/viewHierarchy';
import type {ViewNode} from 'sentry/components/events/viewHierarchy/wireframe';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {PlatformKey, Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {watchForResize} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

export function useResizeCanvasObserver(canvases: Array<HTMLCanvasElement | null>): Rect {
  const [bounds, setCanvasBounds] = useState<Rect>(Rect.Empty());

  useLayoutEffect(() => {
    if (!canvases.length) {
      return undefined;
    }

    if (canvases.includes(null)) {
      return undefined;
    }

    const observer = watchForResize(canvases as HTMLCanvasElement[], entries => {
      const contentRect =
        entries[0]!.contentRect ?? entries[0]!.target.getBoundingClientRect();

      setCanvasBounds(
        new Rect(
          contentRect.x,
          contentRect.y,
          contentRect.width * window.devicePixelRatio,
          contentRect.height * window.devicePixelRatio
        )
      );
    });

    return () => {
      observer.disconnect();
    };
  }, [canvases]);

  return bounds;
}

export function getHierarchyDimensions(
  hierarchies: ViewHierarchyWindow[],
  useAbsolutePosition = false
): {
  maxHeight: number;
  maxWidth: number;
  nodes: ViewNode[];
} {
  const nodes: ViewNode[] = [];
  const queue: Array<[Rect | null, ViewHierarchyWindow]> = [];
  for (let i = hierarchies.length - 1; i >= 0; i--) {
    queue.push([null, hierarchies[i]!]);
  }

  let maxWidth = Number.MIN_SAFE_INTEGER;
  let maxHeight = Number.MIN_SAFE_INTEGER;

  while (queue.length) {
    const [parent, child] = queue.pop()!;

    const node = {
      node: child,
      rect: new Rect(
        useAbsolutePosition ? (child.x ?? 0) : (parent?.x ?? 0) + (child.x ?? 0),
        useAbsolutePosition ? (child.y ?? 0) : (parent?.y ?? 0) + (child.y ?? 0),
        child.width ?? 0,
        child.height ?? 0
      ),
    };
    nodes.push(node);

    if (defined(child.children) && child.children.length) {
      // Push the children into the queue in reverse order because the
      // output nodes should have early children before later children
      // i.e. we need to pop() off early children before ones that come after
      for (let i = child.children.length - 1; i >= 0; i--) {
        queue.push([node.rect, child.children[i]!]);
      }
    }

    maxWidth = Math.max(maxWidth, node.rect.x + (node.rect.width ?? 0));
    maxHeight = Math.max(maxHeight, node.rect.y + (node.rect.height ?? 0));
  }

  return {nodes, maxWidth, maxHeight};
}

export function calculateScale(
  bounds: {height: number; width: number},
  maxCoordinateDimensions: {height: number; width: number},
  border: {x: number; y: number}
) {
  return Math.min(
    (bounds.width - border.x) / maxCoordinateDimensions.width,
    (bounds.height - border.y) / maxCoordinateDimensions.height
  );
}

export function getDeepestNodeAtPoint(
  nodes: ViewNode[],
  point: vec2,
  transformationMatrix: mat3,
  scale: number
): ViewNode | null {
  let clickedNode: ViewNode | null = null;
  const inverseMatrix = mat3.invert(mat3.create(), transformationMatrix);
  if (!inverseMatrix) {
    return null;
  }

  vec2.scale(point, point, scale);
  const transformedPoint = vec2.transformMat3(vec2.create(), point, inverseMatrix);
  for (const node of nodes) {
    if (node.rect.contains(transformedPoint)) {
      clickedNode = node;
    }
  }

  return clickedNode;
}

type ViewConfig = {
  emptyMessage: string;
  nodeField: ViewHierarchyNodeField;
  showWireframe: boolean;
  title: string;
};

const defaultViewConfig: ViewConfig = {
  title: t('View Hierarchy'),
  emptyMessage: t('There is no view hierarchy data to visualize'),
  nodeField: 'type',
  showWireframe: true,
};

export function getPlatformViewConfig(platform?: string): ViewConfig {
  if (!platform) {
    return defaultViewConfig;
  }

  switch (platform) {
    case 'godot':
      return {
        title: t('Scene Tree'),
        emptyMessage: t('There is no scene tree data to visualize'),
        nodeField: 'name',
        showWireframe: false,
      };
    case 'unity':
      return {
        ...defaultViewConfig,
        showWireframe: false,
      };
    default:
      return defaultViewConfig;
  }
}

/**
 * Retrieves the platform from the event or project. A project may use one platform (e.g., 'javascript-react'),
 * but events may come from a different SDK (e.g., python). Currently supports Unity and Godot, but a general sdk-to-platform
 * mapping would be ideal.
 */
export function getPlatform({
  event,
  project,
}: {
  event: Event;
  project: Project;
}): PlatformKey | undefined {
  const platform = event.sdk?.name ?? project.platform;

  if (!platform) {
    return undefined;
  }

  if (platform.endsWith('unity')) {
    return 'unity';
  }

  if (platform.endsWith('godot')) {
    return 'godot';
  }

  return project.platform;
}
