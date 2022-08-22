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

export function analyzeStringForRepr(value: string) {
  const rv = {
    repr: value,
    isString: true,
    isMultiLine: false,
    isStripped: false,
  };

  // stripped for security reasons
  if (value.match(/^['"]?\*{8,}['"]?$/)) {
    rv.isStripped = true;
    return rv;
  }

  if (looksLikeObjectRepr(value)) {
    rv.isString = false;
    return rv;
  }

  rv.isMultiLine = looksLikeMultiLineString(value);
  return rv;
}
