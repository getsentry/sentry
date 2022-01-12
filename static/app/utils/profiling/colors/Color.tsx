import {toRGBAString} from './utils';

export class Color {
  r: number;
  g: number;
  b: number;
  a: number;

  constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  static fromLCH(color: number[]): Color {
    // Initialize alpha to full opacity so we dont end up not seeing colors in case of wrong initial values
    return new Color(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 1);
  }

  withAlpha(alpha: number): Color {
    return Color.fromLCH([this.r, this.g, this.b, alpha]);
  }

  toRGBAString(): string {
    return toRGBAString(this.r, this.g, this.b, this.a);
  }
}
