import * as Sentry from '@sentry/react';
import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphSearch} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {getFlamegraphFrameSearchId} from 'sentry/utils/profiling/flamegraphFrame';
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
import {
  DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS,
  FlamegraphRenderer,
  FlamegraphRendererOptions,
} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {fragment, vertex} from './shaders';

// These are both mutable and are used to avoid unnecessary allocations during rendering.
const PHYSICAL_SPACE_PX = new Rect(0, 0, 1, 1);
const CONFIG_TO_PHYSICAL_SPACE = mat3.create();
const VERTICES_PER_FRAME = 6;
const COLOR_COMPONENTS = 4;

const MATCHED_SEARCH_FRAME_ATTRIBUTES: Readonly<Float32Array> = new Float32Array(
  VERTICES_PER_FRAME
).fill(1);
const UNMATCHED_SEARCH_FRAME_ATTRIBUTES: Readonly<Float32Array> = new Float32Array(
  VERTICES_PER_FRAME
).fill(0);

export class FlamegraphRendererWebGL extends FlamegraphRenderer {
  ctx: WebGLRenderingContext | null = null;
  program: WebGLProgram | null = null;

  // Vertex and color buffer
  positions: Float32Array = new Float32Array();
  bounds: Float32Array = new Float32Array();
  colors: Float32Array = new Float32Array();
  searchResults: Float32Array = new Float32Array();

  lastDragPosition: vec2 | null = null;

  attributes: {
    a_bounds: number | null;
    a_color: number | null;
    a_is_search_result: number | null;
    a_position: number | null;
  } = {
    a_position: null,
    a_color: null,
    a_bounds: null,
    a_is_search_result: null,
  };

  uniforms: {
    u_border_width: WebGLUniformLocation | null;
    u_draw_border: WebGLUniformLocation | null;
    u_grayscale: WebGLUniformLocation | null;
    u_model: WebGLUniformLocation | null;
    u_projection: WebGLUniformLocation | null;
  } = {
    u_border_width: null,
    u_draw_border: null,
    u_model: null,
    u_grayscale: null,
    u_projection: null,
  };

  constructor(
    canvas: HTMLCanvasElement,
    flamegraph: Flamegraph,
    theme: FlamegraphTheme,
    options: FlamegraphRendererOptions = DEFAULT_FLAMEGRAPH_RENDERER_OPTIONS
  ) {
    super(canvas, flamegraph, theme, options);

    if (
      VERTICES_PER_FRAME * COLOR_COMPONENTS * this.frames.length !==
      this.colorBuffer.length
    ) {
      throw new Error('Color buffer length does not match the number of vertices');
    }

    this.colors = new Float32Array(this.colorBuffer);

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

    const FRAME_COUNT = this.frames.length;

    this.bounds = new Float32Array(VERTICES_PER_FRAME * BOUNDS * FRAME_COUNT);
    this.positions = new Float32Array(VERTICES_PER_FRAME * POSITIONS * FRAME_COUNT);
    this.searchResults = new Float32Array(FRAME_COUNT * VERTICES_PER_FRAME);

    for (let index = 0; index < FRAME_COUNT; index++) {
      const frame = this.frames[index];

      const x1 = frame.start;
      const x2 = frame.end;
      const y1 = frame.depth;
      const y2 = frame.depth + 1;

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
    // Setup webgl canvas context
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
      return;
    }

    this.uniforms = {
      u_border_width: null,
      u_draw_border: null,
      u_grayscale: null,
      u_model: null,
      u_projection: null,
    };
    this.attributes = {
      a_bounds: null,
      a_color: null,
      a_is_search_result: null,
      a_position: null,
    };

    const vertexShader = createShader(this.ctx, this.ctx.VERTEX_SHADER, vertex());
    const fragmentShader = createShader(
      this.ctx,
      this.ctx.FRAGMENT_SHADER,
      fragment(this.theme)
    );

    // create program
    this.program = createProgram(this.ctx, vertexShader, fragmentShader);

    // initialize uniforms
    for (const uniform in this.uniforms) {
      this.uniforms[uniform] = getUniform(this.ctx, this.program, uniform);
    }

    // initialize and upload search results buffer data
    this.attributes.a_is_search_result = getAttribute(
      this.ctx,
      this.program,
      'a_is_search_result'
    );
    createAndBindBuffer(this.ctx, this.searchResults, this.ctx.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.ctx, this.attributes.a_is_search_result, {
      size: 1,
      type: this.ctx.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });

    // initialize and upload color buffer data
    this.attributes.a_color = getAttribute(this.ctx, this.program, 'a_color');
    createAndBindBuffer(this.ctx, this.colors, this.ctx.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.ctx, this.attributes.a_color, {
      size: 4,
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

    // Check if we should draw border - order matters here
    // https://stackoverflow.com/questions/60673970/uniform-value-not-stored-if-i-put-the-gluniform1f-call-before-the-render-loop
    this.ctx.uniform1i(this.uniforms.u_draw_border, this.options.draw_border ? 1 : 0);
    this.ctx.uniform1i(this.uniforms.u_grayscale, 0);
  }

  setSearchResults(query: string, searchResults: FlamegraphSearch['results']['frames']) {
    if (!this.program || !this.ctx) {
      return;
    }

    this.ctx.uniform1i(
      this.uniforms.u_grayscale,
      query.length > 0 || searchResults.size > 0 ? 1 : 0
    );
    this.updateSearchResultsBuffer(searchResults);
  }

  private updateSearchResultsBuffer(
    searchResults: FlamegraphSearch['results']['frames']
  ) {
    if (!this.program || !this.ctx) {
      return;
    }

    for (let i = 0; i < this.frames.length; i++) {
      this.searchResults.set(
        searchResults.has(getFlamegraphFrameSearchId(this.frames[i]))
          ? MATCHED_SEARCH_FRAME_ATTRIBUTES
          : UNMATCHED_SEARCH_FRAME_ATTRIBUTES,
        i * 6
      );
    }

    this.attributes.a_is_search_result = getAttribute(
      this.ctx,
      this.program,
      'a_is_search_result'
    );
    createAndBindBuffer(this.ctx, this.searchResults, this.ctx.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.ctx, this.attributes.a_is_search_result, {
      size: 1,
      type: this.ctx.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });
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

    this.ctx.drawArrays(this.ctx.TRIANGLES, 0, this.frames.length * VERTICES_PER_FRAME);
  }
}
