import forEach from 'lodash/forEach';
import isObject from 'lodash/isObject';
import set from 'lodash/set';

export function unflattenKeys(obj: Record<string, string>): Record<string, any> {
  const result = {};
  forEach(obj, (value, key) => {
    set(result, key.split('.'), value);
  });
  return result;
}

export function flattenKeys(obj: any): Record<string, string> {
  const result = {};
  forEach(obj, (value, key) => {
    if (isObject(value)) {
      forEach(value, (innerValue, innerKey) => {
        result[`${key}.${innerKey}`] = innerValue;
      });
    } else {
      result[key] = value;
    }
  });
  return result;
}
