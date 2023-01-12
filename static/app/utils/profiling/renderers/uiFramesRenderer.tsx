import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';

import {
  createProgram,
  createShader,
  getContext,
  makeProjectionMatrix,
  Rect,
  resizeCanvasToDisplaySize,
} from '../gl/utils';
import {UIFrameNode, UIFrames} from '../uiFrames';

import {fragment, vertex} from './shaders';

// These are both mutable and are used to avoid unnecessary allocations during rendering.
const PHYSICAL_SPACE_PX = new Rect(0, 0, 1, 1);
const CONFIG_TO_PHYSICAL_SPACE = mat3.create();

class UIFramesRenderer {
  canvas: HTMLCanvasElement | null;
  uiFrames: UIFrames;

  gl: WebGLRenderingContext | null = null;
  program: WebGLProgram | null = null;

  theme: FlamegraphTheme;

  // Vertex and color buffer
  positions: Float32Array = new Float32Array();
  bounds: Float32Array = new Float32Array();
  colors: Float32Array = new Float32Array();
  searchResults: Float32Array = new Float32Array();

  colorMap: Map<string | number, number[]> = new Map();

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
    u_model: WebGLUniformLocation | null;
    u_projection: WebGLUniformLocation | null;
  } = {
    u_border_width: null,
    u_draw_border: null,
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
    const VERTICES = 6;
    const COLOR_COMPONENTS = 4;

    this.colors = new Float32Array(VERTICES * COLOR_COMPONENTS);

    this.initCanvasContext();
    this.initVertices();
    this.initShaders();
  }

  initVertices(): void {
    const POSITIONS = 2;
    const BOUNDS = 4;
    const VERTICES = 6;

    const FRAME_COUNT = this.uiFrames.frames.length;

    this.bounds = new Float32Array(VERTICES * BOUNDS * FRAME_COUNT);
    this.positions = new Float32Array(VERTICES * POSITIONS * FRAME_COUNT);
    this.searchResults = new Float32Array(FRAME_COUNT * VERTICES);

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

      // @TODO check if we can pack bounds across vertex calls,
      // we are allocating 6x the amount of memory here
      const boundsOffset = index * VERTICES * BOUNDS;

      for (let i = 0; i < VERTICES; i++) {
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
      u_draw_border: null,
      u_model: null,
      u_projection: null,
    };
    this.attributes = {
      a_bounds: null,
      a_color: null,
      a_is_search_result: null,
      a_position: null,
    };

    const vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertex());

    const fragmentShader = createShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      fragment(this.theme)
    );

    // create program
    this.program = createProgram(this.gl, vertexShader, fragmentShader);

    const uProjectionMatrix = this.gl.getUniformLocation(this.program, 'u_projection');
    const uModelMatrix = this.gl.getUniformLocation(this.program, 'u_model');
    const uBorderWidth = this.gl.getUniformLocation(this.program, 'u_border_width');
    const uDrawBorder = this.gl.getUniformLocation(this.program, 'u_draw_border');

    if (!uProjectionMatrix) {
      throw new Error('Could not locate u_projection in shader');
    }
    if (!uModelMatrix) {
      throw new Error('Could not locate u_model in shader');
    }
    if (!uBorderWidth) {
      throw new Error('Could not locate u_border_width in shader');
    }
    if (!uDrawBorder) {
      throw new Error('Could not locate u_draw_border in shader');
    }

    this.uniforms.u_projection = uProjectionMatrix;
    this.uniforms.u_model = uModelMatrix;
    this.uniforms.u_border_width = uBorderWidth;
    this.uniforms.u_draw_border = uDrawBorder;

    this.gl.uniform1i(this.uniforms.u_draw_border, 1);

    {
      const aIsSearchResult = this.gl.getAttribLocation(
        this.program,
        'a_is_search_result'
      );

      if (aIsSearchResult === -1) {
        throw new Error('Could not locate a_is_search_result in shader');
      }

      // attributes get data from buffers
      this.attributes.a_is_search_result = aIsSearchResult;

      // Init color buffer
      const searchResultsBuffer = this.gl.createBuffer();

      // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = searchResultsBuffer)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, searchResultsBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.searchResults, this.gl.DYNAMIC_DRAW);

      const size = 1;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;

      this.gl.vertexAttribPointer(aIsSearchResult, size, type, normalize, stride, offset);
      // Point to attribute location
      this.gl.enableVertexAttribArray(aIsSearchResult);
    }

    {
      const aColorAttributeLocation = this.gl.getAttribLocation(this.program, 'a_color');

      if (aColorAttributeLocation === -1) {
        throw new Error('Could not locate a_color in shader');
      }

      // attributes get data from buffers
      this.attributes.a_color = aColorAttributeLocation;

      // Init color buffer
      const colorBuffer = this.gl.createBuffer();

      // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = colorBuffer)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.colors, this.gl.STATIC_DRAW);

      const size = 4;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;

      this.gl.vertexAttribPointer(
        aColorAttributeLocation,
        size,
        type,
        normalize,
        stride,
        offset
      );
      // Point to attribute location
      this.gl.enableVertexAttribArray(aColorAttributeLocation);
    }

    {
      // look up where the vertex data needs to go.
      const aPositionAttributeLocation = this.gl.getAttribLocation(
        this.program,
        'a_position'
      );

      if (aPositionAttributeLocation === -1) {
        throw new Error('Could not locate a_color in shader');
      }

      // attributes get data from buffers
      this.attributes.a_position = aPositionAttributeLocation;

      // Init position buffer
      const positionBuffer = this.gl.createBuffer();

      // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.positions, this.gl.STATIC_DRAW);

      const size = 2;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;

      this.gl.vertexAttribPointer(
        aPositionAttributeLocation,
        size,
        type,
        normalize,
        stride,
        offset
      );
      // Point to attribute location
      this.gl.enableVertexAttribArray(aPositionAttributeLocation);
    }

    {
      // look up where the bounds vertices needs to go.
      const aBoundsAttributeLocation = this.gl.getAttribLocation(
        this.program,
        'a_bounds'
      );

      if (aBoundsAttributeLocation === -1) {
        throw new Error('Could not locate a_color in shader');
      }

      // attributes get data from buffers
      this.attributes.a_bounds = aBoundsAttributeLocation;

      // Init bounds buffer
      const boundsBuffer = this.gl.createBuffer();

      // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = boundsBuffer)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, boundsBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.bounds, this.gl.STATIC_DRAW);

      const size = 4;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;

      this.gl.vertexAttribPointer(
        aBoundsAttributeLocation,
        size,
        type,
        normalize,
        stride,
        offset
      );
      // Point to attribute location
      this.gl.enableVertexAttribArray(aBoundsAttributeLocation);
    }

    // Use shader program
    this.gl.useProgram(this.program);
  }

  getColorForFrame(): number[] {
    return this.theme.COLORS.FRAME_FALLBACK_COLOR;
  }

  findHoveredNode(configSpaceCursor: vec2, configSpace: Rect): UIFrameNode | null {
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

    // Run binary search
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

    const VERTICES = 6;
    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.uiFrames.frames.length * VERTICES);
  }
}

export {UIFramesRenderer};
