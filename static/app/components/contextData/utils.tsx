import type {PlatformKey} from 'sentry/types';

const STRING_VALUE_REGEX = /^'(.*)'$/;
const MULTI_LINE_STRING_REGEX = /^'[\s\S]*[\r\n]+[\s\S]*'$/;
const NUMERIC_STRING_REGEX = /^-?\d+(\.\d+)?$/;

export function looksLikeObjectRepr(value: string) {
  const a = value[0];
  const z = value[value.length - 1];

  if (a === '<' && z === '>') {
    return true;
  }

  if (a === '[' && z === ']') {
    return true;
  }

  if (a === '(' && z === ')') {
    return true;
  }

  if (z === ')' && value.match(/^[\w\d._-]+\(/)) {
    return true;
  }

  return false;
}

export function looksLikeNullValue(value: unknown, syntax: PlatformKey | undefined) {
  if (syntax === 'python') {
    return value === 'None' || value === null;
  }

  return value === null;
}

export function printNullValue(syntax: PlatformKey | undefined) {
  if (syntax === 'python') {
    return 'None';
  }

  return 'null';
}

export function looksLikeBooleanValue(value: unknown, syntax: PlatformKey | undefined) {
  if (syntax === 'python') {
    return value === 'True' || value === 'False' || typeof value === 'boolean';
  }

  return typeof value === 'boolean';
}

export function looksLikeNumberValue(value: string, syntax: PlatformKey | undefined) {
  if (syntax === 'python') {
    return NUMERIC_STRING_REGEX.test(value);
  }

  return false;
}

export function printBooleanValue(
  value: unknown,
  syntax: PlatformKey | undefined
): string {
  if (syntax === 'python' && typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  return String(value);
}

export function looksLikeStringValue(value: string, syntax: PlatformKey | undefined) {
  // Python strings are single quoted which allows us to know their data type
  if (syntax === 'python') {
    return STRING_VALUE_REGEX.test(value);
  }

  if (syntax === 'node') {
    return !looksLikeObjectRepr(value);
  }

  // Because other SDKs don't do this we can't be sure if this is a true string
  return false;
}

export function printStringValue(value: string, syntax: PlatformKey | undefined) {
  if (syntax === 'python') {
    return value.replace(STRING_VALUE_REGEX, '"$1"');
  }

  if (syntax === 'node') {
    return `"${value}"`;
  }

  return value;
}

export function looksLikeMultiLineString(value: string, syntax: PlatformKey | undefined) {
  if (syntax === 'python') {
    return MULTI_LINE_STRING_REGEX.test(value);
  }

  return value.includes('\n');
}

export function printMultilineString(value: string, syntax: PlatformKey | undefined) {
  return printStringValue(value, syntax);
}

export function looksLikeStrippedValue(value: string) {
  return value.match(/^['"]?\*{8,}['"]?$/);
}

export function padNumbersInString(string: string) {
  return string.replace(/(\d+)/g, (num: string) => {
    let isNegative = false;
    let realNum = parseInt(num, 10);
    if (realNum < 0) {
      realNum *= -1;
      isNegative = true;
    }
    let s = '0000000000000' + realNum;
    s = s.substr(s.length - (isNegative ? 11 : 12));
    if (isNegative) {
      s = '-' + s;
    }
    return s;
  });
}

export function naturalCaseInsensitiveSort(a: string, b: string) {
  a = padNumbersInString(a).toLowerCase();
  b = padNumbersInString(b).toLowerCase();
  return a === b ? 0 : a < b ? -1 : 1;
}
