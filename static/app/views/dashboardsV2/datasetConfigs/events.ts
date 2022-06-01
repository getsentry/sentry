import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {DatasetConfig} from './base';

export const EventsConfig: DatasetConfig = {
  // TODO: Needs to account for feature flags somehow
  customFieldRenderer: (field, meta) => getFieldRenderer(field, meta, true),
};
