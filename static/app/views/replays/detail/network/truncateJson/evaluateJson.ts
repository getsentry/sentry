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

/**
 * Evaluate an (incomplete) JSON string.
 */
export function evaluateJson(json: string): JsonToken[] {
  const stack: JsonToken[] = [];

  for (let pos = 0; pos < json.length; pos++) {
    _evaluateJsonPos(stack, json, pos);
  }

  return stack;
}

function _evaluateJsonPos(stack: JsonToken[], json: string, pos: number): void {
  const curStep = stack[stack.length - 1];

  const char = json[pos];

  const whitespaceRegex = /\s/;

  if (whitespaceRegex.test(char)) {
    return;
  }

  if (char === '"' && !_isEscaped(json, pos)) {
    _handleQuote(stack, curStep);
    return;
  }

  // eslint-disable-next-line default-case
  switch (char) {
    case '{':
      _handleObj(stack, curStep);
      break;
    case '[':
      _handleArr(stack, curStep);
      break;
    case ':':
      _handleColon(stack, curStep);
      break;
    case ',':
      _handleComma(stack, curStep);
      break;
    case '}':
      _handleObjClose(stack, curStep);
      break;
    case ']':
      _handleArrClose(stack, curStep);
      break;
  }
}

function _handleQuote(stack: JsonToken[], curStep: JsonToken): void {
  // End of obj value
  if (curStep === OBJ_VAL_STR) {
    stack.pop();
    stack.push(OBJ_VAL_COMPLETED);
    return;
  }

  // End of arr value
  if (curStep === ARR_VAL_STR) {
    stack.pop();
    stack.push(ARR_VAL_COMPLETED);
    return;
  }

  // Start of obj value
  if (curStep === OBJ_VAL) {
    stack.push(OBJ_VAL_STR);
    return;
  }

  // Start of arr value
  if (curStep === ARR_VAL) {
    stack.push(ARR_VAL_STR);
    return;
  }

  // Start of obj key
  if (curStep === OBJ) {
    stack.push(OBJ_KEY_STR);
    return;
  }

  // End of obj key
  if (curStep === OBJ_KEY_STR) {
    stack.pop();
    stack.push(OBJ_KEY);
    return;
  }
}

function _handleObj(stack: JsonToken[], curStep: JsonToken): void {
  // Initial object
  if (!curStep) {
    stack.push(OBJ);
    return;
  }

  // New object as obj value
  if (curStep === OBJ_VAL) {
    stack.push(OBJ);
    return;
  }

  // New object as array element
  if (curStep === ARR_VAL) {
    stack.push(OBJ);
  }

  // New object as first array element
  if (curStep === ARR) {
    stack.push(OBJ);
    return;
  }
}

function _handleArr(stack: JsonToken[], curStep: JsonToken): void {
  // Initial array
  if (!curStep) {
    stack.push(ARR);
    stack.push(ARR_VAL);
    return;
  }

  // New array as obj value
  if (curStep === OBJ_VAL) {
    stack.push(ARR);
    stack.push(ARR_VAL);
    return;
  }

  // New array as array element
  if (curStep === ARR_VAL) {
    stack.push(ARR);
    stack.push(ARR_VAL);
  }

  // New array as first array element
  if (curStep === ARR) {
    stack.push(ARR);
    stack.push(ARR_VAL);
    return;
  }
}

function _handleColon(stack: JsonToken[], curStep: JsonToken): void {
  if (curStep === OBJ_KEY) {
    stack.pop();
    stack.push(OBJ_VAL);
  }
}

function _handleComma(stack: JsonToken[], curStep: JsonToken): void {
  // Comma after obj value
  if (curStep === OBJ_VAL) {
    stack.pop();
    return;
  }
  if (curStep === OBJ_VAL_COMPLETED) {
    // Pop OBJ_VAL_COMPLETED & OBJ_VAL
    stack.pop();
    stack.pop();
    return;
  }

  // Comma after arr value
  if (curStep === ARR_VAL) {
    // do nothing - basically we'd pop ARR_VAL but add it right back
    return;
  }

  if (curStep === ARR_VAL_COMPLETED) {
    // Pop ARR_VAL_COMPLETED
    stack.pop();

    // basically we'd pop ARR_VAL but add it right back
    return;
  }
}

function _handleObjClose(stack: JsonToken[], curStep: JsonToken): void {
  // Empty object {}
  if (curStep === OBJ) {
    stack.pop();
  }

  // Object with element
  if (curStep === OBJ_VAL) {
    // Pop OBJ_VAL, OBJ
    stack.pop();
    stack.pop();
  }

  // Obj with element
  if (curStep === OBJ_VAL_COMPLETED) {
    // Pop OBJ_VAL_COMPLETED, OBJ_VAL, OBJ
    stack.pop();
    stack.pop();
    stack.pop();
  }

  // if was obj value, complete it
  if (stack[stack.length - 1] === OBJ_VAL) {
    stack.push(OBJ_VAL_COMPLETED);
  }

  // if was arr value, complete it
  if (stack[stack.length - 1] === ARR_VAL) {
    stack.push(ARR_VAL_COMPLETED);
  }
}

function _handleArrClose(stack: JsonToken[], curStep: JsonToken): void {
  // Empty array []
  if (curStep === ARR) {
    stack.pop();
  }

  // Array with element
  if (curStep === ARR_VAL) {
    // Pop ARR_VAL, ARR
    stack.pop();
    stack.pop();
  }

  // Array with element
  if (curStep === ARR_VAL_COMPLETED) {
    // Pop ARR_VAL_COMPLETED, ARR_VAL, ARR
    stack.pop();
    stack.pop();
    stack.pop();
  }

  // if was obj value, complete it
  if (stack[stack.length - 1] === OBJ_VAL) {
    stack.push(OBJ_VAL_COMPLETED);
  }

  // if was arr value, complete it
  if (stack[stack.length - 1] === ARR_VAL) {
    stack.push(ARR_VAL_COMPLETED);
  }
}

function _isEscaped(str: string, pos: number): boolean {
  const previousChar = str[pos - 1];

  return previousChar === '\\' && !_isEscaped(str, pos - 1);
}
