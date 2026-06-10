import type {Series} from 'sentry/types/echarts';
// eslint-disable-next-line @sentry/scraps/restrict-types-file -- type-only import from a runtime module; extracting a type leaf would cascade to its many importers
import {type EventsMetaType} from 'sentry/utils/discover/eventView';

export type DiscoverSeries = Series & {
  meta: EventsMetaType;
};

export type ExtrapolationMode = 'sampleWeighted' | 'serverOnly' | 'unspecified' | 'none';
