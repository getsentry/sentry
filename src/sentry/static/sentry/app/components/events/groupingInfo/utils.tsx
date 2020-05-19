import isObject from 'lodash/isObject';

import {EventGroupComponent} from 'app/types';

export function hasNonContributingComponent(component: EventGroupComponent | undefined) {
  if (!component?.contributes) {
    return true;
  }
  for (const value of component.values) {
    if (isObject(value) && hasNonContributingComponent(value)) {
      return true;
    }
  }
  return false;
}

export function shouldInlineComponentValue(component: EventGroupComponent) {
  return component.values.every(value => !isObject(value));
}
