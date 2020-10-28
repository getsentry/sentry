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
  return (component.values as EventGroupComponent[]).every(value => !isObject(value));
}

export function groupingComponentFilter(
  value: EventGroupComponent | string,
  showNonContributing: boolean
) {
  if (isObject(value)) {
    // no point rendering such nodes at all, we never show them
    if (!value.contributes && !value.hint && value.values.length === 0) {
      return false;
    }
    // non contributing values are otherwise optional
    if (!showNonContributing && !value.contributes) {
      return false;
    }
  }

  return true;
}
