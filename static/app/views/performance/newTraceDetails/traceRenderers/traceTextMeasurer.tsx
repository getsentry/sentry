import theme from 'sentry/utils/theme';

export class TraceTextMeasurer {
  queue: string[] = [];
  drainRaf: number | null = null;
  cache: Map<string, number> = new Map();

  number = 0;
  dot = 0;
  duration: Record<string, number> = {};

  constructor() {
    this.drain = this.drain.bind(this);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      for (const duration of ['ns', 'ms', 's', 'm', 'min', 'h', 'd']) {
        // If for some reason we fail to create a canvas context, we can
        // use a fallback value for the durations. It shouldnt happen,
        // but it's better to have a fallback than to crash the entire app.
        // I've made a couple manual measurements to determine a good fallback
        // and 6.5px per letter seems like a reasonable approximation.
        const PX_PER_LETTER = 6.5;
        this.duration[duration] = duration.length * PX_PER_LETTER;
      }
      return;
    }

    canvas.width = 50 * window.devicePixelRatio;
    canvas.height = 50 * window.devicePixelRatio;

    ctx.font = '11px' + theme.text.family;

    this.dot = ctx.measureText('.').width;
    for (let i = 0; i < 10; i++) {
      const measurement = ctx.measureText(i.toString());
      this.number = Math.max(this.number, measurement.width);
    }

    for (const duration of ['ns', 'ms', 's', 'm', 'min', 'h', 'd']) {
      this.duration[duration] = ctx.measureText(duration).width;
    }
  }

  drain() {
    for (const string of this.queue) {
      this.measure(string);
    }
  }

  computeStringLength(string: string): number {
    let width = 0;
    for (let i = 0; i < string.length; i++) {
      switch (string[i]) {
        case '.':
          width += this.dot;
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          width += this.number;
          break;
        default: {
          const remaining = string.slice(i);
          if (this.duration[remaining]) {
            width += this.duration[remaining];
            return width;
          }
        }
      }
    }
    return width;
  }

  measure(string: string): number {
    const cached_width = this.cache.get(string);
    if (cached_width !== undefined) {
      return cached_width;
    }

    const width = this.computeStringLength(string);
    this.cache.set(string, width);
    return width;
  }
}
