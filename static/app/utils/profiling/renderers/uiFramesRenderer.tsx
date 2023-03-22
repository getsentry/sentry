import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {
  createAndBindBuffer,
  createProgram,
  createShader,
  getAttribute,
  getContext,
  getUniform,
  makeProjectionMatrix,
  pointToAndEnableVertexAttribute,
  resizeCanvasToDisplaySize,
  upperBound,
} from '../gl/utils';
import {UIFrameNode, UIFrames} from '../uiFrames';

import {uiFramesFragment, uiFramesVertext} from './shaders';

// These are both mutable and are used to avoid unnecessary allocations during rendering.
const PHYSICAL_SPACE_PX = new Rect(0, 0, 1, 1);
const CONFIG_TO_PHYSICAL_SPACE = mat3.create();
const VERTICES_PER_FRAME = 6;

class UIFramesRenderer {
  canvas: HTMLCanvasElement | null;
  uiFrames: UIFrames;

  gl: WebGLRenderingContext | null = null;
  program: WebGLProgram | null = null;

  theme: FlamegraphTheme;

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

  options: {
    draw_border: boolean;
  };

  constructor(
    canvas: HTMLCanvasElement,
    uiFrames: UIFrames,
    theme: FlamegraphTheme,
    options: {draw_border: boolean} = {draw_border: false}
  ) {
    this.uiFrames = uiFrames;
    this.canvas = canvas;
    this.theme = theme;
    this.options = options;

    this.init();
  }

  init(): void {
    this.initCanvasContext();
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
      const frame = this.uiFrames.frames[index];

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

  initCanvasContext(): void {
    if (!this.canvas) {
      throw new Error('Cannot initialize context from null canvas');
    }
    // Setup webgl canvas context
    this.gl = getContext(this.canvas, 'webgl');

    if (!this.gl) {
      throw new Error('Uninitialized WebGL context');
    }

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFuncSeparate(
      this.gl.SRC_ALPHA,
      this.gl.ONE_MINUS_SRC_ALPHA,
      this.gl.ONE,
      this.gl.ONE_MINUS_SRC_ALPHA
    );
    resizeCanvasToDisplaySize(this.canvas);
  }

  initShaders(): void {
    if (!this.gl) {
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

    const vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, uiFramesVertext());
    const fragmentShader = createShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      uiFramesFragment(this.theme)
    );

    // create program
    this.program = createProgram(this.gl, vertexShader, fragmentShader);

    // initialize uniforms
    for (const uniform in this.uniforms) {
      this.uniforms[uniform] = getUniform(this.gl, this.program, uniform);
    }

    // initialize and upload frame type information
    this.attributes.a_frame_type = getAttribute(this.gl, this.program, 'a_frame_type');
    createAndBindBuffer(this.gl, this.frame_types, this.gl.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.gl, this.attributes.a_frame_type, {
      size: 1,
      type: this.gl.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });

    // initialize and upload positions buffer data
    this.attributes.a_position = getAttribute(this.gl, this.program, 'a_position');
    createAndBindBuffer(this.gl, this.positions, this.gl.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.gl, this.attributes.a_position, {
      size: 2,
      type: this.gl.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });

    // initialize and upload bounds buffer data
    this.attributes.a_bounds = getAttribute(this.gl, this.program, 'a_bounds');
    createAndBindBuffer(this.gl, this.bounds, this.gl.STATIC_DRAW);
    pointToAndEnableVertexAttribute(this.gl, this.attributes.a_bounds, {
      size: 4,
      type: this.gl.FLOAT,
      normalized: false,
      stride: 0,
      offset: 0,
    });

    // Use shader program
    this.gl.useProgram(this.program);
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
      const frame = this.uiFrames.frames[i];
      if (configSpaceCursor[0] <= frame.end && configSpaceCursor[0] >= frame.start) {
        overlaps.push(frame);
      }
    }

    if (overlaps.length > 0) {
      return overlaps;
    }
    return null;
  }

  draw(configViewToPhysicalSpace: mat3): void {
    if (!this.gl) {
      throw new Error('Uninitialized WebGL context');
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // We have no frames to draw
    if (!this.positions.length || !this.program) {
      return;
    }

    this.gl.useProgram(this.program);

    const projectionMatrix = makeProjectionMatrix(
      this.gl.canvas.width,
      this.gl.canvas.height
    );

    // Projection matrix
    this.gl.uniformMatrix3fv(this.uniforms.u_projection, false, projectionMatrix);

    // Model to projection
    this.gl.uniformMatrix3fv(this.uniforms.u_model, false, configViewToPhysicalSpace);

    // Tell webgl to convert clip space to px
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    const physicalToConfig = mat3.invert(
      CONFIG_TO_PHYSICAL_SPACE,
      configViewToPhysicalSpace
    );

    const configSpacePixel = PHYSICAL_SPACE_PX.transformRect(physicalToConfig);

    this.gl.uniform2f(
      this.uniforms.u_border_width,
      configSpacePixel.width,
      configSpacePixel.height
    );

    this.gl.drawArrays(
      this.gl.TRIANGLES,
      0,
      this.uiFrames.frames.length * VERTICES_PER_FRAME
    );
  }
}

export {UIFramesRenderer};
