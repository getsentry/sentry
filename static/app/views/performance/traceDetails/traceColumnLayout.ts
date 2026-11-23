import {localStorageWrapper} from 'sentry/utils/localStorage';
import {clamp} from 'sentry/utils/number/clamp';

const STORAGE_KEY = 'trace-waterfall-attribute-column-layout';
export const MIN_PINNED_TRACE_WIDTH = 320;

/** Pixel widths keep the pinned column independent of the timeline's coordinate space. */
export class TraceColumnLayout {
  attributeWidth = 200;
  treeRatio: number;

  constructor(treeRatio: number) {
    this.treeRatio = treeRatio;
    try {
      const stored: unknown = JSON.parse(
        localStorageWrapper.getItem(STORAGE_KEY) ?? 'null'
      );
      if (!stored || typeof stored !== 'object') {
        return;
      }
      if (
        'attributeWidth' in stored &&
        typeof stored.attributeWidth === 'number' &&
        Number.isFinite(stored.attributeWidth) &&
        stored.attributeWidth >= 100
      ) {
        this.attributeWidth = stored.attributeWidth;
      }
      if (
        'treeRatio' in stored &&
        typeof stored.treeRatio === 'number' &&
        Number.isFinite(stored.treeRatio) &&
        stored.treeRatio > 0 &&
        stored.treeRatio < 1
      ) {
        this.treeRatio = stored.treeRatio;
      }
    } catch {
      // A malformed or unavailable browser preference must not prevent opening a trace.
    }
  }

  sizes(availableWidth: number) {
    const width = Math.max(MIN_PINNED_TRACE_WIDTH, availableWidth);
    const attribute = clamp(this.attributeWidth, 100, width - 220);
    const remaining = width - attribute;
    const list = clamp(remaining * this.treeRatio, 120, remaining - 100);
    return {list, attribute, span_list: remaining - list};
  }

  resize(edge: 'left' | 'right', delta: number, availableWidth: number) {
    const sizes = this.sizes(availableWidth);
    if (edge === 'left') {
      const movement = clamp(delta, 120 - sizes.list, sizes.attribute - 100);
      if (movement === 0) {
        return;
      }
      sizes.list += movement;
      sizes.attribute -= movement;
    } else {
      const movement = clamp(delta, 100 - sizes.attribute, sizes.span_list - 100);
      if (movement === 0) {
        return;
      }
      sizes.attribute += movement;
      sizes.span_list -= movement;
    }
    this.attributeWidth = sizes.attribute;
    this.treeRatio = sizes.list / (sizes.list + sizes.span_list);
  }

  save() {
    try {
      localStorageWrapper.setItem(
        STORAGE_KEY,
        JSON.stringify({attributeWidth: this.attributeWidth, treeRatio: this.treeRatio})
      );
    } catch {
      // Resizing still works when storage is unavailable.
    }
  }
}
