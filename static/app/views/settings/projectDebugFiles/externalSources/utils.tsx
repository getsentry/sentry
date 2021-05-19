import forEach from 'lodash/forEach';
import set from 'lodash/set';

export function expandKeys(obj: Record<string, string>): Record<string, any> {
  const result = {};
  forEach(obj, (value, key) => {
    set(result, key.split('.'), value);
  });
  return result;
}
