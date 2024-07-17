import isPlainObject from 'lodash/isPlainObject';

const STRIPPED_VALUE_REGEX = /^['"]?\*{8,}['"]?$/;

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

export function looksLikeMultiLineString(value: string) {
  return !!value.match(/[\r\n]/);
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

export function looksLikeStrippedValue(value: string) {
  return STRIPPED_VALUE_REGEX.test(value);
}

export function getDefaultExpanded(depth: number, value: any) {
  const MAX_ITEMS_BEFORE_AUTOCOLLAPSE = 5;

  function recurse(prefix: string, levels: number, val: any) {
    if (!levels) {
      return [];
    }

    if (Array.isArray(val) && val.length <= MAX_ITEMS_BEFORE_AUTOCOLLAPSE) {
      return [
        prefix,
        ...val.flatMap((v, i) => {
          return recurse(`${prefix}.${i}`, levels - 1, v);
        }),
      ];
    }
    if (isPlainObject(val) && Object.keys(val).length <= MAX_ITEMS_BEFORE_AUTOCOLLAPSE) {
      return [
        prefix,
        ...Object.entries(val).flatMap(([k, v]) => {
          return recurse(`${prefix}.${k}`, levels - 1, v);
        }),
      ];
    }
    return [];
  }

  return recurse('$', depth, value);
}
