import {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

export interface DatasetConfig {
  customFieldRenderer?: (
    field: string,
    meta: MetaType
  ) => ReturnType<typeof getFieldRenderer> | null;
  fieldHeaderMap?: Record<string, string>;
}
