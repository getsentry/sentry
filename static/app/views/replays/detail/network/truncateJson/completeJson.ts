import type {JsonToken} from './constants';
import {
  ARR,
  ARR_VAL,
  ARR_VAL_COMPLETED,
  ARR_VAL_STR,
  OBJ,
  OBJ_KEY,
  OBJ_KEY_STR,
  OBJ_VAL,
  OBJ_VAL_COMPLETED,
  OBJ_VAL_STR,
} from './constants';

const ALLOWED_PRIMITIVES = ['true', 'false', 'null'];

/**
 * Complete an incomplete JSON string.
 * This will ensure that the last element always has a `"~~"` to indicate it was truncated.
 * For example, `[1,2,` will be completed to `[1,2,"~~"]`
 * and `{"aa":"b` will be completed to `{"aa":"b~~"}`
 */
export function completeJson(incompleteJson: string, stack: JsonToken[]): string {
  if (!stack.length) {
    return incompleteJson;
  }

  let json = incompleteJson;

  // Most checks are only needed for the last step in the stack
  const lastPos = stack.length - 1;
  const lastStep = stack[lastPos];

  json = _fixLastStep(json, lastStep);

  // Complete remaining steps - just add closing brackets
  for (let i = lastPos; i >= 0; i--) {
    const step = stack[i];

    // eslint-disable-next-line default-case
    switch (step) {
      case OBJ:
        json = `${json}}`;
        break;
      case ARR:
        json = `${json}]`;
        break;
    }
  }

  return json;
}

function _fixLastStep(json: string, lastStep: JsonToken): string {
  switch (lastStep) {
    // Object cases
    case OBJ:
      return `${json}"~~":"~~"`;
    case OBJ_KEY:
      return `${json}:"~~"`;
    case OBJ_KEY_STR:
      return `${json}~~":"~~"`;
    case OBJ_VAL:
      return _maybeFixIncompleteObjValue(json);
    case OBJ_VAL_STR:
      return `${json}~~"`;
    case OBJ_VAL_COMPLETED:
      return `${json},"~~":"~~"`;

    // Array cases
    case ARR:
      return `${json}"~~"`;
    case ARR_VAL:
      return _maybeFixIncompleteArrValue(json);
    case ARR_VAL_STR:
      return `${json}~~"`;
    case ARR_VAL_COMPLETED:
      return `${json},"~~"`;

    default:
      return json;
  }
}

function _maybeFixIncompleteArrValue(json: string): string {
  const pos = _findLastArrayDelimiter(json);

  if (pos > -1) {
    const part = json.slice(pos + 1);

    if (ALLOWED_PRIMITIVES.includes(part.trim())) {
      return `${json},"~~"`;
    }

    // Everything else is replaced with `"~~"`
    return `${json.slice(0, pos + 1)}"~~"`;
  }

  // fallback, this shouldn't happen, to be save
  return json;
}

function _findLastArrayDelimiter(json: string): number {
  for (let i = json.length - 1; i >= 0; i--) {
    const char = json[i];

    if (char === ',' || char === '[') {
      return i;
    }
  }

  return -1;
}

function _maybeFixIncompleteObjValue(json: string): string {
  const startPos = json.lastIndexOf(':');

  const part = json.slice(startPos + 1);

  if (ALLOWED_PRIMITIVES.includes(part.trim())) {
    return `${json},"~~":"~~"`;
  }

  // Everything else is replaced with `"~~"`
  // This also means we do not have incomplete numbers, e.g `[1` is replaced with `["~~"]`
  return `${json.slice(0, startPos + 1)}"~~"`;
}
