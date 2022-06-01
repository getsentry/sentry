import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {DatasetConfig} from './base';

export const ReleasesConfig: DatasetConfig = {
  customFieldRenderer: (field, meta) => getFieldRenderer(field, meta, false),
};
