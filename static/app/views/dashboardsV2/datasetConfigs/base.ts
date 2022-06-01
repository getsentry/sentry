import {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {WidgetType} from '../types';

import {EventsConfig} from './events';
import {IssuesConfig} from './issues';
import {ReleasesConfig} from './releases';

export interface DatasetConfig {
  customFieldRenderer?: (
    field: string,
    meta: MetaType
  ) => ReturnType<typeof getFieldRenderer> | null;
  fieldHeaderMap?: Record<string, string>;
}

export function getDatasetConfig(type: WidgetType) {
  switch (type) {
    case WidgetType.RELEASE:
      return ReleasesConfig;
    case WidgetType.ISSUE:
      return IssuesConfig;
    case WidgetType.DISCOVER:
    default:
      return EventsConfig;
  }
}
