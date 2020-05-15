import isObject from 'lodash/isObject';

export function hasNonContributingComponent(component) {
  if (!component.contributes) {
    return true;
  }
  for (const value of component.values) {
    if (isObject(value) && hasNonContributingComponent(value)) {
      return true;
    }
  }
  return false;
}
