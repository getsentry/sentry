export function valueIsEqual(value?: any, other?: any, deep?: boolean): boolean {
  if (value === other) {
    return true;
  }
  if (Array.isArray(value) || Array.isArray(other)) {
    if (arrayIsEqual(value, other, deep)) {
      return true;
    }
  } else if (
    (value && typeof value === 'object') ||
    (other && typeof other === 'object')
  ) {
    if (objectMatchesSubset(value, other, deep)) {
      return true;
    }
  }
  return false;
}

function arrayIsEqual(arr?: any[], other?: any[], deep?: boolean): boolean {
  // if the other array is a falsy value, return
  if (!arr && !other) {
    return true;
  }

  if (!arr || !other) {
    return false;
  }

  // compare lengths - can save a lot of time
  if (arr.length !== other.length) {
    return false;
  }

  return arr.every((val, idx) => valueIsEqual(val, other[idx], deep));
}

function objectMatchesSubset(obj?: object, other?: object, deep?: boolean): boolean {
  let k: string;

  if (obj === other) {
    return true;
  }

  if (!obj || !other) {
    return false;
  }

  if (deep !== true) {
    for (k in other) {
      if (obj[k] !== other[k]) {
        return false;
      }
    }
    return true;
  }

  for (k in other) {
    if (!valueIsEqual(obj[k], other[k], deep)) {
      return false;
    }
  }
  return true;
}
