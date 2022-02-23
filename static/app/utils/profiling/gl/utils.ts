import {mat3, vec2} from 'gl-matrix';

import {clamp} from '../colors/utils';

export function createShader(
  gl: WebGLRenderingContext,
  type: WebGLRenderingContext['VERTEX_SHADER'] | WebGLRenderingContext['FRAGMENT_SHADER'],
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Could not create shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  gl.deleteShader(shader);
  throw new Error('Failed to compile shader');
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Could not create program');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  gl.deleteProgram(program);
  throw new Error('Failed to create program');
}

// Create a projection matrix with origins at 0,0 in top left corner, scaled to width/height
export function makeProjectionMatrix(width: number, height: number): mat3 {
  const projectionMatrix = mat3.create();

  mat3.identity(projectionMatrix);
  mat3.translate(projectionMatrix, projectionMatrix, vec2.fromValues(-1, 1));
  mat3.scale(
    projectionMatrix,
    projectionMatrix,
    vec2.divide(vec2.create(), vec2.fromValues(2, -2), vec2.fromValues(width, height))
  );

  return projectionMatrix;
}

const canvasToDisplaySizeMap = new Map<HTMLCanvasElement, [number, number]>();

function onResize(entries: ResizeObserverEntry[]) {
  for (const entry of entries) {
    let width;
    let height;
    let dpr = window.devicePixelRatio;
    // @ts-ignore use as a progressive enhancement, some browsers don't support this yet
    if (entry.devicePixelContentBoxSize) {
      // NOTE: Only this path gives the correct answer
      // The other paths are imperfect fallbacks
      // for browsers that don't provide anyway to do this
      // @ts-ignore
      width = entry.devicePixelContentBoxSize[0].inlineSize;
      // @ts-ignore
      height = entry.devicePixelContentBoxSize[0].blockSize;
      dpr = 1; // it's already in width and height
    } else if (entry.contentBoxSize) {
      if (entry.contentBoxSize[0]) {
        width = entry.contentBoxSize[0].inlineSize;
        height = entry.contentBoxSize[0].blockSize;
      } else {
        // @ts-ignore
        width = entry.contentBoxSize.inlineSize;
        // @ts-ignore
        height = entry.contentBoxSize.blockSize;
      }
    } else {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    }
    const displayWidth = Math.round(width * dpr);
    const displayHeight = Math.round(height * dpr);
    canvasToDisplaySizeMap.set(entry.target as HTMLCanvasElement, [
      displayWidth,
      displayHeight,
    ]);

    resizeCanvasToDisplaySize(entry.target as HTMLCanvasElement);
  }
}

export const watchForResize = (
  canvas: HTMLCanvasElement[],
  callback?: () => void
): ResizeObserver => {
  const handler: ResizeObserverCallback = entries => {
    onResize(entries);
    callback?.();
  };

  for (const c of canvas) {
    canvasToDisplaySizeMap.set(c, [c.width, c.height]);
  }

  const resizeObserver = new ResizeObserver(handler);

  try {
    // only call us of the number of device pixels changed
    canvas.forEach(c => {
      resizeObserver.observe(c, {box: 'device-pixel-content-box'});
    });
  } catch (ex) {
    // device-pixel-content-box is not supported so fallback to this
    canvas.forEach(c => {
      resizeObserver.observe(c, {box: 'content-box'});
    });
  }

  return resizeObserver;
};

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
  // Get the size the browser is displaying the canvas in device pixels.
  const size = canvasToDisplaySizeMap.get(canvas);

  if (!size) {
    const displayWidth = canvas.clientWidth * window.devicePixelRatio;
    const displayHeight = canvas.clientHeight * window.devicePixelRatio;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    return false;
  }

  const [displayWidth, displayHeight] = size;
  // Check if the canvas is not the same size.
  const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;

  if (needResize) {
    // Make the canvas the same size
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}

export const Transform = {
  betweenRect(from: Rect, to: Rect): Rect {
    return new Rect(to.x, to.y, to.width / from.width, to.height / from.height);
  },
  transformMatrixBetweenRect(from: Rect, to: Rect): mat3 {
    return mat3.fromValues(
      to.width / from.width,
      0,
      0,
      0,
      to.height / from.height,
      0,
      -((from.x * to.width) / from.width),
      -((from.y * to.height) / from.height),
      1
    );
  },
};

export class Rect {
  origin: vec2;
  size: vec2;

  constructor(x: number, y: number, width: number, height: number) {
    this.origin = vec2.fromValues(x, y);
    this.size = vec2.fromValues(width, height);
  }

  isValid(): boolean {
    return this.toMatrix().every(n => !isNaN(n));
  }

  isEmpty(): boolean {
    return this.width === 0 && this.height === 0;
  }

  static Empty(): Rect {
    return new Rect(0, 0, 0, 0);
  }

  static From(rect: Rect): Rect {
    return new Rect(rect.x, rect.y, rect.width, rect.height);
  }

  get x(): number {
    return this.origin[0];
  }
  get y(): number {
    return this.origin[1];
  }
  get width(): number {
    return this.size[0];
  }
  get height(): number {
    return this.size[1];
  }
  get left(): number {
    return this.x;
  }
  get right(): number {
    return this.left + this.width;
  }
  get top(): number {
    return this.y;
  }
  get bottom(): number {
    return this.top + this.height;
  }

  toMatrix(): mat3 {
    const {width: w, height: h, x, y} = this;
    // it's easier to display a matrix as a 3x3 array. WebGl matrices are row first and not column first
    // https://webglfundamentals.org/webgl/lessons/webgl-matrix-vs-math.html
    // prettier-ignore
    return mat3.fromValues(
      w, 0, 0,
      0, h, 0,
      x, y, 1
    )
  }

  hasIntersectionWith(other: Rect): boolean {
    const top = Math.max(this.top, other.top);
    const bottom = Math.max(top, Math.min(this.bottom, other.bottom));
    if (bottom - top === 0) {
      return false;
    }

    const left = Math.max(this.left, other.left);
    const right = Math.max(left, Math.min(this.right, other.right));

    if (right - left === 0) {
      return false;
    }
    return true;
  }

  containsX(vec: vec2): boolean {
    return vec[0] >= this.left && vec[0] <= this.right;
  }
  containsY(vec: vec2): boolean {
    return vec[1] >= this.top && vec[1] <= this.bottom;
  }

  contains(vec: vec2): boolean {
    return this.containsX(vec) && this.containsY(vec);
  }

  containsRect(rect: Rect): boolean {
    return this.left <= rect.left && rect.right <= this.right;
  }

  overlapsX(other: Rect): boolean {
    return this.left <= other.right && this.right >= other.left;
  }

  overlapsY(other: Rect): boolean {
    return this.top <= other.bottom && this.bottom >= other.top;
  }

  overlaps(other: Rect): boolean {
    return this.overlapsX(other) && this.overlapsY(other);
  }

  // When we transform rectangles with a 3x3 matrix, we scale width with m00 and height with m11, then translate
  // the origin of the rect separately with m02 and m12.
  transformRect(transform: mat3): Rect {
    const configSpaceOrigin = vec2.fromValues(this.x, this.y);
    const configSpaceSize = vec2.fromValues(this.width, this.height);

    // prettier-ignore
    const [
      m00, m01, _m02,
      m10, m11, _m12,
      m20, m21, _m22
    ] = transform

    // prettier-ignore
    const newConfigSpaceSize = [
      configSpaceSize[0] * m00 + configSpaceSize[1] * m01, // X
      configSpaceSize[0] * m10 + configSpaceSize[1] * m11  // Y
    ]
    // prettier-ignore
    const newConfigSpaceOrigin = [
      configSpaceOrigin[0] * m00 + configSpaceOrigin[1] * m01 + m20, // X
      configSpaceOrigin[0] * m10 + configSpaceOrigin[1] * m11 + m21  // Y
    ]

    return new Rect(
      newConfigSpaceOrigin[0],
      newConfigSpaceOrigin[1],
      newConfigSpaceSize[0],
      newConfigSpaceSize[1]
    );
  }

  withHeight(height: number): Rect {
    return new Rect(this.x, this.y, this.width, height);
  }

  withWidth(width: number): Rect {
    return new Rect(this.x, this.y, width, this.height);
  }

  toBounds(): [number, number, number, number] {
    return [this.x, this.y, this.x + this.width, this.y + this.height];
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.width, this.height];
  }

  between(to: Rect): Rect {
    return new Rect(to.x, to.y, to.width / this.width, to.height / this.height);
  }

  translate(x: number, y: number): Rect {
    return new Rect(x, y, this.width, this.height);
  }

  translateX(x: number): Rect {
    return new Rect(x, this.y, this.width, this.height);
  }

  translateY(y: number): Rect {
    return new Rect(this.x, y, this.width, this.height);
  }

  scaleX(x: number): Rect {
    return new Rect(this.x, this.y, this.width * x, this.height);
  }

  scaleY(y: number): Rect {
    return new Rect(this.x, this.y, this.width, this.height * y);
  }

  scale(x: number, y: number): Rect {
    return new Rect(this.x * x, this.y * y, this.width * x, this.height * y);
  }

  scaleOriginBy(x: number, y: number): Rect {
    return new Rect(this.x * x, this.y * y, this.width, this.height);
  }

  scaledBy(x: number, y: number): Rect {
    return new Rect(this.x, this.y, this.width * x, this.height * y);
  }

  equals(rect: Rect): boolean {
    if (this.x !== rect.x) {
      return false;
    }
    if (this.y !== rect.y) {
      return false;
    }
    if (this.width !== rect.width) {
      return false;
    }
    if (this.height !== rect.height) {
      return false;
    }
    return true;
  }

  notEqualTo(rect: Rect): boolean {
    return !this.equals(rect);
  }
}

function getContext(canvas: HTMLCanvasElement, context: '2d'): CanvasRenderingContext2D;
function getContext(canvas: HTMLCanvasElement, context: 'webgl'): WebGLRenderingContext;
function getContext(canvas: HTMLCanvasElement, context: string): RenderingContext {
  const ctx =
    context === 'webgl'
      ? canvas.getContext(context, {antialias: false})
      : canvas.getContext(context);
  if (!ctx) {
    throw new Error(`Could not get context ${context}`);
  }
  return ctx;
}

// Exporting this like this instead of writing export function for each overload as
// it breaks the lines and makes it harder to read.
export {getContext};

export function measureText(string: string, ctx?: CanvasRenderingContext2D): Rect {
  if (!string) {
    return Rect.Empty();
  }

  const context = ctx || getContext(document.createElement('canvas'), '2d');
  const measures = context.measureText(string);

  return new Rect(
    0,
    0,
    measures.width,
    // https://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
    measures.actualBoundingBoxAscent + measures.actualBoundingBoxDescent
  );
}

/** Find closest min and max value to target */
export function findRangeBinarySearch(
  {low, high}: {high: number; low: number},
  fn: (val: number) => number,
  target: number,
  precision = 1
): [number, number] {
  if (target < low || target > high) {
    throw new Error(
      `Target has to be in range of low <= target <= high, got ${low} <= ${target} <= ${high}`
    );
  }
  // eslint-disable-next-line
  while (true) {
    if (high - low <= precision) {
      return [low, high];
    }

    const mid = (high + low) / 2;
    if (fn(mid) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }
}

export const ELLIPSIS = '\u2026';
export function trimTextCenter(text: string, low: number) {
  if (low >= text.length) {
    return text;
  }
  const prefixLength = Math.floor(low / 2);
  // Use 1 character less than the low value to account for ellipsis
  // and favor displaying the prefix
  const postfixLength = low - prefixLength - 1;

  return `${text.substring(0, prefixLength)}${ELLIPSIS}${text.substring(
    text.length - postfixLength + ELLIPSIS.length
  )}`;
}

export function computeClampedConfigView(
  newConfigView: Rect,
  width: {max: number; min: number},
  height: {max: number; min: number},
  inverted: boolean
) {
  if (!newConfigView.isValid()) {
    throw new Error(newConfigView.toString());
  }
  const clampedWidth = clamp(newConfigView.width, width.min, width.max);
  const clampedHeight = clamp(newConfigView.height, height.min, height.max);

  const maxX = width.max - clampedWidth;
  const maxY =
    clampedHeight >= height.max + (inverted ? 1 : 0)
      ? 0
      : height.max - clampedHeight + (inverted ? 1 : 0);

  const clampedX = clamp(newConfigView.x, 0, maxX);
  const clampedY = clamp(newConfigView.y, 0, maxY);

  return new Rect(clampedX, clampedY, clampedWidth, clampedHeight);
}
