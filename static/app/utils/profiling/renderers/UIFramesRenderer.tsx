import type {mat3, vec2} from 'gl-matrix';

import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import type {Rect} from 'sentry/utils/profiling/speedscope';
import type {UIFrameNode, UIFrames} from 'sentry/utils/profiling/uiFrames';

import {upperBound} from '../gl/utils';

export interface UIFramesRendererConstructor {
  new (
    canvas: HTMLCanvasElement,
    uiFrames: UIFrames,
    theme: FlamegraphTheme,
    options?: {draw_border: boolean}
  ): UIFramesRenderer;
}

export abstract class UIFramesRenderer {
  ctx: CanvasRenderingContext2D | WebGLRenderingContext | null = null;
  canvas: HTMLCanvasElement | null;
  uiFrames: UIFrames;
  theme: FlamegraphTheme;
  options: {
    draw_border: boolean;
  };

  constructor(
    canvas: HTMLCanvasElement,
    uiFrames: UIFrames,
    theme: FlamegraphTheme,
    options: {draw_border: boolean} = {draw_border: false}
  ) {
    this.canvas = canvas;
    this.uiFrames = uiFrames;
    this.theme = theme;
    this.options = options;
  }

  findHoveredNode(configSpaceCursor: vec2, configSpace: Rect): UIFrameNode[] | null {
    // ConfigSpace origin is at top of rectangle, so we need to offset bottom by 1
    // to account for size of renderered rectangle.
    if (configSpaceCursor[1] > configSpace.bottom + 1) {
      return null;
    }

    if (configSpaceCursor[0] < configSpace.left) {
      return null;
    }

    if (configSpaceCursor[0] > configSpace.right) {
      return null;
    }

    const overlaps: UIFrameNode[] = [];
    // We can find the upper boundary, but because frames might overlap, we need to also check anything
    // before the upper boundary to see if it overlaps... Performance does not seem to be a big concern
    // here as the max number of slow frames we can have is max profile duration / slow frame = 30000/
    const end = upperBound(configSpaceCursor[0], this.uiFrames.frames);

    for (let i = 0; i < end; i++) {
      const frame = this.uiFrames.frames[i]!;
      if (configSpaceCursor[0] <= frame.end && configSpaceCursor[0] >= frame.start) {
        overlaps.push(frame);
      }
    }

    if (overlaps.length > 0) {
      return overlaps;
    }
    return null;
  }

  getColorForFrame(
    type: UIFrames['frames'][0]['type']
  ): [number, number, number, number] {
    if (type === 'frozen') {
      return this.theme.COLORS.UI_FRAME_COLOR_FROZEN;
    }
    return this.theme.COLORS.UI_FRAME_COLOR_SLOW;
  }

  abstract draw(configViewToPhysicalSpace: mat3): void;
}
