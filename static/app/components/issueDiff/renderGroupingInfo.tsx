import {t} from 'sentry/locale';
import {EventGroupComponent, EventGroupInfo, EventGroupVariant} from 'sentry/types';

function renderGroupingInfo(groupingInfo: EventGroupInfo): string[] {
  return Object.values(groupingInfo).map(renderGroupVariant).flat();
}

function renderGroupVariant(variant: EventGroupVariant): string[] {
  const title = [t('Type: %s', variant.type)];

  if (variant.hash) {
    title.push(t('Hash: %s', variant.hash));
  }

  if (variant.description) {
    title.push(t('Description: %s', variant.description));
  }

  const rv = [title.join('\n')];

  if ('component' in variant && variant.component) {
    rv.push(renderComponent(variant.component).join('\n'));
  }

  return rv;
}

function renderComponent(component: EventGroupComponent): string[] {
  if (!component.contributes) {
    return [];
  }

  const {name, id, hint} = component;
  const name_or_id = name || id;
  const title = name_or_id && hint ? `${name_or_id} (${hint})` : name_or_id;
  const rv = title ? [title] : [];

  if (component.values) {
    for (const value of component.values) {
      if (typeof value === 'string') {
        rv.push(`  ${value}`);
        continue;
      }

      for (const line of renderComponent(value)) {
        rv.push(`  ${line}`);
      }
    }
  }

  return rv;
}

export default renderGroupingInfo;
