import {mat3} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {UIFrames} from 'sentry/utils/profiling/uiFrames';

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

  abstract draw(configViewToPhysicalSpace: mat3): void;
}
