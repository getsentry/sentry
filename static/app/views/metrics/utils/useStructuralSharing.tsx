import {useMemo, useRef} from 'react';

/**
 * Check if two objects have the same keys
 */
const checkSameKeys = (obj1: any, obj2: any) => {
  const keys1 = new Set(Object.keys(obj1));
  const keys2 = new Set(Object.keys(obj2));
  if (keys1.size !== keys2.size) {
    return false;
  }
  for (const key in keys1) {
    if (!keys2.has(key)) {
      return false;
    }
  }
  return true;
};

/**
 * Merge oldVlaue and newValue while trying to preserve references of unchanged objects / arrays
 */
export function structuralSharing<T>(oldValue: T, newValue: T): T {
  if (oldValue === newValue) {
    return oldValue;
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    let hasChanges = oldValue.length !== newValue.length;
    const newArray = newValue.map((item, index) => {
      const newItem = structuralSharing(oldValue[index], item);
      if (newItem !== oldValue[index]) {
        hasChanges = true;
      }
      return newItem;
    });
    return hasChanges ? (newArray as any) : oldValue;
  }

  if (oldValue === null || newValue === null) {
    return newValue;
  }

  if (typeof oldValue === 'object' && typeof newValue === 'object') {
    let hasChanges = !checkSameKeys(oldValue, newValue);
    const newObj = Object.keys(newValue).reduce((acc, key) => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      acc[key] = structuralSharing(oldValue[key], newValue[key]);
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (acc[key] !== oldValue[key]) {
        hasChanges = true;
      }
      return acc;
    }, {});
    return hasChanges ? (newObj as any) : oldValue;
  }

  return newValue;
}

export function useStructuralSharing<T>(value: T): T {
  const previousValue = useRef<T>(value);
  return useMemo(() => {
    const newValue = structuralSharing(previousValue.current, value);
    previousValue.current = newValue;
    return newValue;
  }, [value]);
}
