import type {EventGroupComponent} from 'sentry/types/event';

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

type FrameGroup = {
  data: EventGroupComponent[];
  key: string;
};

export function getFrameGroups(
  component: EventGroupComponent,
  showNonContributing: boolean
): FrameGroup[] {
  const frameGroups: FrameGroup[] = [];

  if (!Array.isArray(component.values)) {
    return frameGroups;
  }

  component.values
    .filter(
      (value): value is EventGroupComponent =>
        typeof value === 'object' && value !== null && 'id' in value
    )
    .filter(value => groupingComponentFilter(value, showNonContributing))
    .forEach(value => {
      if (!Array.isArray(value.values)) {
        return;
      }

      const key = value.values
        .filter(
          (v): v is EventGroupComponent =>
            typeof v === 'object' && v !== null && 'id' in v
        )
        .filter(v => groupingComponentFilter(v, showNonContributing))
        .map(v => v.id)
        .sort((a, b) => a.localeCompare(b))
        .join('');

      const lastGroup = frameGroups[frameGroups.length - 1];

      if (lastGroup?.key === key) {
        lastGroup.data.push(value);
      } else {
        frameGroups.push({key, data: [value]});
      }
    });

  return frameGroups;
}
