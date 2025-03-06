// Port of some helper classes from speedscope, a lot of these have been changed to fit our usage and the port
// is not probably no longer very accurate so see speedscope source for better references.

// MIT License

// Copyright (c) 2018 Jamie Wong

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import {mat3, vec2} from 'gl-matrix';

import {clamp} from 'sentry/utils/profiling/colors/utils';

import type {ColorChannels, LCH} from './flamegraph/flamegraphTheme';
import type {TrimTextCenter} from './gl/utils';
import {ELLIPSIS} from './gl/utils';

export class Rect {
  origin: vec2;
  size: vec2;

  constructor(x: number, y: number, width: number, height: number) {
    this.origin = vec2.fromValues(x, y);
    this.size = vec2.fromValues(width, height);
  }

  clone(): Rect {
    return Rect.From(this);
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
  get centerX(): number {
    return this.x + this.width / 2;
  }
  get centerY(): number {
    return this.y + this.height / 2;
  }
  get center(): vec2 {
    return [this.centerX, this.centerY];
  }

  static decode(query: string | readonly string[] | null | undefined): Rect | null {
    let maybeEncodedRect = query;

    if (typeof query === 'string') {
      maybeEncodedRect = query.split(',');
    }

    if (!Array.isArray(maybeEncodedRect)) {
      return null;
    }

    if (maybeEncodedRect.length !== 4) {
      return null;
    }

    const rect = new Rect(
      ...(maybeEncodedRect.map(p => parseFloat(p)) as [number, number, number, number])
    );

    if (rect.isValid()) {
      return rect;
    }

    return null;
  }

  static encode(rect: Rect): string {
    return rect.toString();
  }

  toString() {
    return [this.x, this.y, this.width, this.height].map(n => Math.round(n)).join(',');
  }

  toMatrix(): mat3 {
    const {width: w, height: h, x, y} = this;
    // it's easier to display a matrix as a 3x3 array. WebGl matrices are row first and not column first
    // https://webglfundamentals.org/webgl/lessons/webgl-matrix-vs-math.html
    // prettier-ignore
    return mat3.fromValues(w, 0, 0, 0, h, 0, x, y, 1);
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
    return (
      this.left <= rect.left &&
      rect.right <= this.right &&
      this.top <= rect.top &&
      rect.bottom <= this.bottom
    );
  }

  leftOverlapsWith(rect: Rect): boolean {
    return rect.left <= this.left && rect.right >= this.left;
  }

  rightOverlapsWith(rect: Rect): boolean {
    return this.right >= rect.left && this.right <= rect.right;
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

  transformRect(transform: mat3 | Readonly<mat3> | null): Rect {
    if (!transform) {
      return this.clone();
    }

    const x = this.x * transform[0] + this.y * transform[3] + transform[6];
    const y = this.x * transform[1] + this.y * transform[4] + transform[7];
    const width = this.width * transform[0] + this.height * transform[3];
    const height = this.width * transform[1] + this.height * transform[4];

    return new Rect(
      x + (width < 0 ? width : 0),
      y + (height < 0 ? height : 0),
      Math.abs(width),
      Math.abs(height)
    );
  }

  /**
   * Returns a transform that inverts the y axis within the rect.
   * This causes the bottom of the rect to be the top of the rect and vice versa.
   */
  invertYTransform(): mat3 {
    return mat3.fromValues(1, 0, 0, 0, -1, 0, 0, this.y * 2 + this.height, 1);
  }

  withHeight(height: number): Rect {
    return new Rect(this.x, this.y, this.width, height);
  }

  withWidth(width: number): Rect {
    return new Rect(this.x, this.y, width, this.height);
  }

  withX(x: number): Rect {
    return new Rect(x, this.y, this.width, this.height);
  }

  withY(y: number) {
    return new Rect(this.x, y, this.width, this.height);
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

export function findRangeBinarySearch(
  {low, high}: {high: number; low: number},
  fn: (val: number) => number,
  target: number,
  precision = 1
): [number, number] {
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

export const fract = (x: number): number => x - Math.floor(x);
export const triangle = (x: number): number => 2.0 * Math.abs(fract(x) - 0.5) - 1.0;
export function fromLumaChromaHue(L: number, C: number, H: number): ColorChannels {
  const hPrime = H / 60;
  const X = C * (1 - Math.abs((hPrime % 2) - 1));
  const [R1, G1, B1] =
    hPrime < 1
      ? [C, X, 0]
      : hPrime < 2
        ? [X, C, 0]
        : hPrime < 3
          ? [0, C, X]
          : hPrime < 4
            ? [0, X, C]
            : hPrime < 5
              ? [X, 0, C]
              : [C, 0, X];

  const m = L - (0.35 * R1 + 0.35 * G1 + 0.35 * B1);
  return [clamp(R1 + m, 0, 1), clamp(G1 + m, 0, 1), clamp(B1 + m, 0, 1.0)];
}

// Modified to allow only a part of the spectrum
export function makeColorBucketTheme(
  lch: LCH,
  spectrum = 360,
  offset = 0
): (t: number) => ColorChannels {
  return t => {
    const x = triangle(30.0 * t);
    const tx = 0.9 * t;
    const H = spectrum < 360 ? offset + spectrum * tx : spectrum * tx;
    const C = lch.C_0 + lch.C_d * x;
    const L = lch.L_0 - lch.L_d * x;
    return fromLumaChromaHue(L, C, H);
  };
}

export function trimTextCenter(text: string, low: number): TrimTextCenter {
  if (low >= text.length) {
    return {
      text,
      start: 0,
      end: 0,
      length: 0,
    };
  }

  const prefixLength = Math.floor(low / 2);
  // Use 1 character less than the low value to account for ellipsis and favor displaying the prefix
  const postfixLength = low - prefixLength - 1;

  const start = prefixLength;
  const end = Math.floor(text.length - postfixLength + ELLIPSIS.length);
  const trimText = `${text.substring(0, start)}${ELLIPSIS}${text.substring(end)}`;

  return {
    text: trimText,
    start,
    end,
    length: end - start,
  };
}

// This differs, but the underlying logic is similar, we just support a mat3 as the transform
// because our charts can be offset on the x axis.
export function computeInterval(
  configView: Rect,
  logicalSpaceToConfigView: mat3,
  getInterval: (mat: mat3, x: number) => number
): number[] {
  const target = 200;
  const targetInterval = getInterval(logicalSpaceToConfigView, target) - configView.left;

  const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));
  let interval = minInterval;

  if (targetInterval / interval > 5) {
    interval *= 5;
  } else if (targetInterval / interval > 2) {
    interval *= 2;
  }

  let x = Math.ceil(configView.left / interval) * interval;
  const intervals: number[] = [];

  while (x <= configView.right) {
    intervals.push(x);
    x += interval;
  }

  return intervals;
}
