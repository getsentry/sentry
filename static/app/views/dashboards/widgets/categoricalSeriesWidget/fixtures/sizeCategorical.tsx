import {SizeUnit} from 'sentry/utils/discover/fields';
import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleSizeData: CategoricalSeries = {
  valueAxis: 'avg(http.response_content_length)',
  meta: {
    valueType: 'size',
    valueUnit: SizeUnit.BYTE,
  },
  values: [
    {category: '/api/assets', value: 2_500_000},
    {category: '/api/images', value: 8_750_000},
    {category: '/api/videos', value: 45_000_000},
    {category: '/api/documents', value: 1_250_000},
    {category: '/api/thumbnails', value: 125_000},
  ],
};
