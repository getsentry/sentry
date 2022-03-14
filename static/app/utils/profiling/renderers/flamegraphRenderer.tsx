import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from '../flamegraph';
import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {FlamegraphFrame} from '../flamegraphFrame';
import {Frame} from '../frame';
import {
  computeClampedConfigView,
  createProgram,
  createShader,
  getContext,
  makeProjectionMatrix,
  Rect,
  resizeCanvasToDisplaySize,
} from '../gl/utils';

import {fragment, vertex} from './shaders';

class FlamegraphRenderer {
  canvas: HTMLCanvasElement | null;
  flamegraph: Flamegraph;

  gl: WebGLRenderingContext | null = null;
  program: WebGLProgram | null = null;

  theme: FlamegraphTheme;
  origin: vec2;
  frames: ReadonlyArray<FlamegraphFrame> = [];
  roots: ReadonlyArray<FlamegraphFrame> = [];

  // Vertex and color buffer
  positions: Array<number> = [];
  bounds: Array<number> = [];
  colors: Array<number> = [];

  colorMap: Map<string | number, number[]> = new Map();

  logicalSpace: Rect = Rect.Empty();
  logicalToPhysicalSpace: mat3 = mat3.create();

  physicalSpace: Rect = new Rect(0, 0, 0, 0);
  physicalToLogicalSpace: mat3 = mat3.create();

  configSpace: Rect = new Rect(0, 0, 0, 0);
  configView: Rect = new Rect(0, 0, 0, 0);

  lastDragPosition: vec2 | null = null;

  attributes: {
    a_bounds: number | null;
    a_color: number | null;
    a_position: number | null;
  } = {
    a_position: null,
    a_color: null,
    a_bounds: null,
  };

  uniforms: {
    u_border_width: WebGLUniformLocation | null;
    u_draw_border: WebGLUniformLocation | null;
    u_is_search_result: WebGLUniformLocation | null;
    u_model: WebGLUniformLocation | null;
    u_projection: WebGLUniformLocation | null;
  } = {
    u_border_width: null,
    u_draw_border: null,
    u_is_search_result: null,
    u_model: null,
    u_projection: null,
  };

  options: {
    draw_border: boolean;
  };

  constructor(
    canvas: HTMLCanvasElement,
    flamegraph: Flamegraph,
    theme: FlamegraphTheme,
    origin: vec2 = vec2.fromValues(0, 0),
    options: {draw_border: boolean} = {draw_border: false}
  ) {
    this.flamegraph = flamegraph;
    this.canvas = canvas;
    this.theme = theme;
    this.origin = origin;
    this.options = options;

    this.init();
  }

  init(): void {
    const VERTICES = 6;
    const COLOR_COMPONENTS = 4;

    this.colors = new Array(VERTICES * COLOR_COMPONENTS);
    this.frames = [...this.flamegraph.frames];
    this.roots = this.flamegraph.frames.filter(f => !f.parent);

    // Generate colors for the flamegraph
    const {colorBuffer, colorMap} = this.theme.COLORS.STACK_TO_COLOR(
      this.frames,
      this.theme.COLORS.COLOR_MAP,
      this.theme.COLORS.COLOR_BUCKET
    );
    this.colorMap = colorMap;
    this.colors = colorBuffer;

    this.initCanvasContext();
    this.initPhysicalSpace();
    this.initConfigSpace();
    this.initVertices();
    this.initShaders();
  }

  initPhysicalSpace(): void {
    if (!this.gl) {
      throw new Error('Uninitialized WebGL context');
    }

    // Setup physical space which may differ depending on device px ratio
    this.physicalSpace = new Rect(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.logicalSpace = this.physicalSpace.scaledBy(
      1 / window.devicePixelRatio,
      1 / window.devicePixelRatio
    );

    this.logicalToPhysicalSpace = mat3.fromScaling(
      mat3.create(),
      vec2.fromValues(window.devicePixelRatio, window.devicePixelRatio)
    );
    this.physicalToLogicalSpace = mat3.invert(mat3.create(), this.logicalToPhysicalSpace);
  }

  get configSpaceToPhysicalSpace(): mat3 {
    return mat3.fromValues(
      this.physicalSpace.width / this.configSpace.width,
      0,
      0,
      0,
      this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio,
      0,
      -((this.configSpace.x * this.physicalSpace.width) / this.configSpace.width) +
        this.origin[0],
      -(this.configSpace.y * this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio) +
        this.origin[1],
      1
    );
  }

  get configToPhysicalSpace(): mat3 {
    return mat3.fromValues(
      this.physicalSpace.width / this.configView.width,
      0,
      0,
      0,
      this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio,
      0,
      -((this.configView.x * this.physicalSpace.width) / this.configView.width) +
        this.origin[0],
      -(this.configView.y * this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio) +
        this.origin[1],
      1
    );
  }

  initConfigSpace(): void {
    const BAR_HEIGHT = this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio;

    this.configSpace = new Rect(
      0,
      0,
      this.flamegraph.configSpace.width,
      Math.max(
        this.flamegraph.depth + this.theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET,
        this.physicalSpace.height / BAR_HEIGHT - (this.flamegraph.inverted ? 1 : 0)
      )
    );

    this.configView = Rect.From(this.configSpace).withHeight(
      this.physicalSpace.height / BAR_HEIGHT
    );

    if (this.flamegraph.inverted) {
      this.configView = this.configView.translateY(
        this.configSpace.height - this.configView.height + 1
      );
    }
  }

  onResizeUpdateSpace(): void {
    this.initPhysicalSpace();

    const BAR_HEIGHT = this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio;

    this.configSpace = new Rect(
      0,
      0,
      this.flamegraph.configSpace.width,
      Math.max(
        this.flamegraph.depth + this.theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET,
        this.physicalSpace.height / BAR_HEIGHT - (this.flamegraph.inverted ? 1 : 0)
      )
    );

    this.configView = Rect.From(this.configView).withHeight(
      this.physicalSpace.height / BAR_HEIGHT
    );

    if (this.flamegraph.inverted) {
      this.configView = this.configView.translateY(
        this.configSpace.height - this.configView.height + 1
      );
    }
  }

  initVertices(): void {
    const POSITIONS_PER_PASS = 2;
    const BOUNDS_PER_PASS = 4;
    const VERTICES = 6;

    this.bounds = new Array(VERTICES * BOUNDS_PER_PASS * this.frames.length);
    this.positions = new Array(VERTICES * POSITIONS_PER_PASS * this.frames.length);

    const length = this.frames.length;

    for (let index = 0; index < length; index++) {
      const frame = this.frames[index];
      const depth = this.flamegraph.inverted
        ? this.configSpace.height - frame.depth
        : frame.depth;

      const x1 = frame.start;
      const x2 = frame.end;
      const y1 = depth;
      const y2 = depth + 1;

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
      const boundsOffset = index * VERTICES * BOUNDS_PER_PASS;

      for (let i = 0; i < VERTICES; i++) {
        const offset = boundsOffset + i * BOUNDS_PER_PASS;

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

    // @ts-ignore
    this.uniforms = {};
    // @ts-ignore
    this.attributes = {};

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
    const uIsSearchResult = this.gl.getUniformLocation(
      this.program,
      'u_is_search_result'
    );
    const uBorderWidth = this.gl.getUniformLocation(this.program, 'u_border_width');
    const uDrawBorder = this.gl.getUniformLocation(this.program, 'u_draw_border');

    if (!uProjectionMatrix) {
      throw new Error('Could not locate u_projection in shader');
    }
    if (!uModelMatrix) {
      throw new Error('Could not locate u_model in shader');
    }
    if (!uIsSearchResult) {
      throw new Error('Could not locate u_is_search_result in shader');
    }
    if (!uBorderWidth) {
      throw new Error('Could not locate u_border_width in shader');
    }
    if (!uDrawBorder) {
      throw new Error('Could not locate u_draw_border in shader');
    }

    this.uniforms.u_projection = uProjectionMatrix;
    this.uniforms.u_model = uModelMatrix;
    this.uniforms.u_is_search_result = uIsSearchResult;
    this.uniforms.u_border_width = uBorderWidth;
    this.uniforms.u_draw_border = uDrawBorder;

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
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(this.colors),
        this.gl.STATIC_DRAW
      );

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
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(this.positions),
        this.gl.STATIC_DRAW
      );
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
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(this.bounds),
        this.gl.STATIC_DRAW
      );
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

  setConfigView(configView: Rect): Rect {
    this.configView = computeClampedConfigView(
      configView,
      {
        min: this.flamegraph.profile.minFrameDuration,
        max: this.configSpace.width,
      },
      {
        min: 0,
        max: this.configSpace.height,
      },
      !!this.flamegraph.inverted
    );
    return this.configView;
  }

  transformConfigView(transformation: mat3): Rect {
    const newConfigViewSpace = this.configView.transformRect(transformation);

    this.configView = computeClampedConfigView(
      newConfigViewSpace,
      {
        min: this.flamegraph.profile.minFrameDuration,
        max: this.configSpace.width,
      },
      {
        min: 0,
        max: this.configSpace.height,
      },
      !!this.flamegraph.inverted
    );

    return this.configView;
  }

  getColorForFrame(frame: Frame): number[] {
    return this.colorMap.get(frame.key) ?? this.theme.COLORS.FRAME_FALLBACK_COLOR;
  }

  getConfigSpaceCursor(
    logicalSpaceCursor: vec2,
    configToPhysicalSpace: mat3 = this.configToPhysicalSpace
  ): vec2 {
    const physicalSpaceCursor = vec2.transformMat3(
      vec2.create(),
      logicalSpaceCursor,
      this.logicalToPhysicalSpace
    );

    const physicalToConfig = mat3.invert(mat3.create(), configToPhysicalSpace);
    return vec2.transformMat3(vec2.create(), physicalSpaceCursor, physicalToConfig);
  }

  getHoveredNode(configSpaceCursor: vec2): FlamegraphFrame | null {
    let hoveredNode: FlamegraphFrame | null = null;

    const findHoveredNode = (frame: FlamegraphFrame, depth: number) => {
      // This is outside
      if (hoveredNode) {
        return;
      }

      const frameRect = new Rect(
        frame.start,
        this.flamegraph.inverted ? this.configSpace.height - frame.depth : frame.depth,
        frame.end - frame.start,
        1
      );

      // We treat entire flamegraph as a segment tree, this allows us to query in O(log n) time by
      // only looking at the nodes that are relevant to the current cursor position. We discard any values
      // on x axis that do not overlap the cursor, and descend until we find a node that overlaps at cursor y position
      if (!frameRect.containsX(configSpaceCursor)) {
        return;
      }

      // If our frame depth overlaps cursor y position, we have found our node
      if (frameRect.containsY(configSpaceCursor)) {
        hoveredNode = frame;
        return;
      }

      // Descend into the rest of the children
      for (const child of frame.children) {
        findHoveredNode(child, depth + 1);
      }
    };

    for (let i = 0; i < this.roots.length; i++) {
      findHoveredNode(this.roots[i], 0);
    }

    return hoveredNode;
  }

  draw(
    searchResults: Record<FlamegraphFrame['frame']['key'], FlamegraphFrame> | null,
    configToPhysicalSpace = this.configToPhysicalSpace
  ): void {
    if (!this.gl) {
      throw new Error('Uninitialized WebGL context');
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // We have no frames to draw
    if (!this.positions.length) {
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
    this.gl.uniformMatrix3fv(this.uniforms.u_model, false, configToPhysicalSpace);

    // Check if we should draw border
    this.gl.uniform1i(this.uniforms.u_draw_border, this.options.draw_border ? 1 : 0);

    // Tell webgl to convert clip space to px
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    const physicalSpacePixel = new Rect(0, 0, 1, 1);
    const physicalToConfig = mat3.invert(mat3.create(), configToPhysicalSpace);
    const configSpacePixel = physicalSpacePixel.transformRect(physicalToConfig);

    this.gl.uniform2f(
      this.uniforms.u_border_width,
      configSpacePixel.width,
      configSpacePixel.height
    );

    const VERTICES = 6;

    const length = this.frames.length;
    let frame;

    // This is an optimization to avoid setting uniform1i for each draw call when user is not searching
    if (searchResults) {
      for (let i = 0; i < length; i++) {
        frame = this.frames[i];
        const vertexOffset = i * VERTICES;

        this.gl.uniform1i(
          this.uniforms.u_is_search_result,
          searchResults[
            `${
              frame.frame.name +
              (frame.frame.file ? frame.frame.file : '') +
              String(frame.start)
            }`
          ]
            ? 1
            : 0
        );
        this.gl.drawArrays(this.gl.TRIANGLES, vertexOffset, VERTICES);
      }
    } else {
      for (let i = 0; i < length; i++) {
        const vertexOffset = i * VERTICES;

        this.gl.drawArrays(this.gl.TRIANGLES, vertexOffset, VERTICES);
      }
    }
  }
}

export {FlamegraphRenderer};
