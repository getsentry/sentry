import type {EventGroupComponent} from 'sentry/types/event';

export function hasNonContributingComponent(component: EventGroupComponent | undefined) {
  if (component === undefined) {
    return false;
  }

  if (!component.contributes) {
    return true;
  }

  for (const value of component.values) {
    if (value && typeof value === 'object' && hasNonContributingComponent(value)) {
      return true;
    }
  }
  return false;
}

export function shouldInlineComponentValue(component: EventGroupComponent) {
  return (component.values as EventGroupComponent[]).every(
    value => !value || typeof value !== 'object'
  );
}

export function groupingComponentFilter(
  value: EventGroupComponent | string,
  showNonContributing: boolean
) {
  if (value && typeof value === 'object') {
    // no point rendering such nodes at all, we never show them
    if (!value.contributes && !value.hint && value.values.length === 0) {
      return false;
    }
    // non-contributing values are otherwise optional
    if (!showNonContributing && !value.contributes) {
      return false;
    }
  }

  return true;
}
