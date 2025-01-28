import * as Sentry from '@sentry/react';
import {mat3} from 'gl-matrix';

import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {
  createAndBindBuffer,
  createProgram,
  createShader,
  getAttribute,
  getUniform,
  makeProjectionMatrix,
  pointToAndEnableVertexAttribute,
  resizeCanvasToDisplaySize,
  safeGetContext,
} from 'sentry/utils/profiling/gl/utils';
import {UIFramesRenderer} from 'sentry/utils/profiling/renderers/UIFramesRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import type {UIFrames} from 'sentry/utils/profiling/uiFrames';

import {uiFramesFragment, uiFramesVertext} from './shaders';

// These are both mutable and are used to avoid unnecessary allocations during rendering.
const PHYSICAL_SPACE_PX = new Rect(0, 0, 1, 1);
const CONFIG_TO_PHYSICAL_SPACE = mat3.create();
const VERTICES_PER_FRAME = 6;

class UIFramesRendererWebGL extends UIFramesRenderer {
  ctx: WebGLRenderingContext | null = null;
  program: WebGLProgram | null = null;

  // Vertex and color buffer
  positions: Float32Array = new Float32Array();
  frame_types: Float32Array = new Float32Array();
  bounds: Float32Array = new Float32Array();

  colorMap: Map<string | number, number[]> = new Map();

  attributes: {
    a_bounds: number | null;
    a_frame_type: number | null;
    a_position: number | null;
  } = {
    a_bounds: null,
    a_frame_type: null,
    a_position: null,
  };

  uniforms: {
    u_border_width: WebGLUniformLocation | null;
    u_model: WebGLUniformLocation | null;
    u_projection: WebGLUniformLocation | null;
  } = {
    u_border_width: null,
    u_model: null,
    u_projection: null,
  };

  constructor(
    canvas: HTMLCanvasElement,
    uiFrames: UIFrames,
    theme: FlamegraphTheme,
    options: {draw_border: boolean} = {draw_border: false}
  ) {
    super(canvas, uiFrames, theme, options);

    const initialized = this.initCanvasContext();
    if (!initialized) {
      Sentry.captureMessage('WebGL not supported');
      return;
    }

    this.initVertices();
    this.initShaders();
  }

  initVertices(): void {
    const POSITIONS = 2;
    const BOUNDS = 4;

    const FRAME_COUNT = this.uiFrames.frames.length;

    this.positions = new Float32Array(VERTICES_PER_FRAME * POSITIONS * FRAME_COUNT);
    this.frame_types = new Float32Array(FRAME_COUNT * VERTICES_PER_FRAME);
    this.bounds = new Float32Array(VERTICES_PER_FRAME * BOUNDS * FRAME_COUNT);

    for (let index = 0; index < FRAME_COUNT; index++) {
      const frame = this.uiFrames.frames[index]!;

      const x1 = frame.start;
      const x2 = frame.end;
      // UIFrames have no notion of depth
      const y1 = 0;
      const y2 = 1;

      // top left -> top right -> bottom left ->
      // bottom left -> top right -> bottom right
      const positionOffset = index * 12;

      this.positions[positionOffset] = x1;
      this.positions[positionOffset + 1] = y1;
      this.positions[positionOffset + 2] = x2;
      this.positions[positionOffset + 3] = y1;
      this.positions[positionOffset + 4] = x1;
      this.positions[positionOffset + 5] = y2;
      this.positions[positionOffset + 6] = x1;
      this.positions[positionOffset + 7] = y2;
      this.positions[positionOffset + 8] = x2;
      this.positions[positionOffset + 9] = y1;
      this.positions[positionOffset + 10] = x2;
      this.positions[positionOffset + 11] = y2;

      const type = frame.type === 'frozen' ? 1 : 0;

      const typeOffset = index * VERTICES_PER_FRAME;
      this.frame_types[typeOffset] = type;

      this.frame_types[typeOffset + 1] = type;
      this.frame_types[typeOffset + 2] = type;
      this.frame_types[typeOffset + 3] = type;
      this.frame_types[typeOffset + 4] = type;
      this.frame_types[typeOffset + 5] = type;

      // @TODO check if we can pack bounds across vertex calls,
      // we are allocating 6x the amount of memory here
      const boundsOffset = index * VERTICES_PER_FRAME * BOUNDS;

      for (let i = 0; i < VERTICES_PER_FRAME; i++) {
        const offset = boundsOffset + i * BOUNDS;

        this.bounds[offset] = x1;
        this.bounds[offset + 1] = y1;
        this.bounds[offset + 2] = x2;
        this.bounds[offset + 3] = y2;
      }
    }
  }

  initCanvasContext(): boolean {
    if (!this.canvas) {
      throw new Error('Cannot initialize context from null canvas');
    }

    this.ctx = safeGetContext(this.canvas, 'webgl');
    if (!this.ctx) {
      return false;
    }

    this.ctx.enable(this.ctx.BLEND);
    this.ctx.blendFuncSeparate(
      this.ctx.SRC_ALPHA,
      this.ctx.ONE_MINUS_SRC_ALPHA,
      this.ctx.ONE,
      this.ctx.ONE_MINUS_SRC_ALPHA
    );
    resizeCanvasToDisplaySize(this.canvas);
    return true;
  }

  initShaders(): void {
    if (!this.ctx) {
      throw new Error('Uninitialized WebGL context');
    }

    this.uniforms = {
      u_border_width: null,
      u_model: null,
      u_projection: null,
    };
    this.attributes = {
      a_position: null,
      a_bounds: null,
      a_frame_type: null,
    };

    const vertexShader = createShader(
      this.ctx,
      this.ctx.VERTEX_SHADER,
      uiFramesVertext()
    );
    const fragmentShader = createShader(
      this.ctx,
      this.ctx.FRAGMENT_SHADER,
      uiFramesFragment(this.theme)
    );

    // create program
    this.program = createProgram(this.ctx, vertexShader, fragmentShader);

    // initialize uniforms
    for (const uniform in this.uniforms) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      this.uniforms[uniform] = getUniform(this.ctx, this.program, uniform);
    }

    // initialize and upload frame type information
    this.attributes.a_frame_type = getAttribute(this.ctx, this.program, 'a_frame_type');
    createAndBindBuffer(this.ctx, this.frame_types, this.ctx.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.ctx, this.attributes.a_frame_type, {
      size: 1,
      type: this.ctx.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });

    // initialize and upload positions buffer data
    this.attributes.a_position = getAttribute(this.ctx, this.program, 'a_position');
    createAndBindBuffer(this.ctx, this.positions, this.ctx.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.ctx, this.attributes.a_position, {
      size: 2,
      type: this.ctx.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });

    // initialize and upload bounds buffer data
    this.attributes.a_bounds = getAttribute(this.ctx, this.program, 'a_bounds');
    createAndBindBuffer(this.ctx, this.bounds, this.ctx.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.ctx, this.attributes.a_bounds, {
      size: 4,
      type: this.ctx.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });

    // Use shader program
    this.ctx.useProgram(this.program);
  }

  getColorForFrame(type: 'frozen' | 'slow'): [number, number, number, number] {
    if (type === 'frozen') {
      return this.theme.COLORS.UI_FRAME_COLOR_FROZEN;
    }
    if (type === 'slow') {
      return this.theme.COLORS.UI_FRAME_COLOR_SLOW;
    }
    throw new Error(`Invalid frame type - ${type}`);
  }

  draw(configViewToPhysicalSpace: mat3): void {
    if (!this.ctx) {
      throw new Error('Uninitialized WebGL context');
    }

    this.ctx.clearColor(0, 0, 0, 0);
    this.ctx.clear(this.ctx.COLOR_BUFFER_BIT);

    // We have no frames to draw
    if (!this.positions.length || !this.program) {
      return;
    }

    this.ctx.useProgram(this.program);

    const projectionMatrix = makeProjectionMatrix(
      this.ctx.canvas.width,
      this.ctx.canvas.height
    );

    // Projection matrix
    this.ctx.uniformMatrix3fv(this.uniforms.u_projection, false, projectionMatrix);

    // Model to projection
    this.ctx.uniformMatrix3fv(this.uniforms.u_model, false, configViewToPhysicalSpace);

    // Tell webgl to convert clip space to px
    this.ctx.viewport(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    const physicalToConfig = mat3.invert(
      CONFIG_TO_PHYSICAL_SPACE,
      configViewToPhysicalSpace
    );

    const configSpacePixel = PHYSICAL_SPACE_PX.transformRect(physicalToConfig);

    this.ctx.uniform2f(
      this.uniforms.u_border_width,
      configSpacePixel.width,
      configSpacePixel.height
    );

    this.ctx.drawArrays(
      this.ctx.TRIANGLES,
      0,
      this.uiFrames.frames.length * VERTICES_PER_FRAME
    );
  }
}

export {UIFramesRendererWebGL};
