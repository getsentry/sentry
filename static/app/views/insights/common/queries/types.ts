import type {Series} from 'sentry/types/echarts';
import {type EventsMetaType} from 'sentry/utils/discover/eventView';

export type DiscoverSeries = Series & {
  meta: EventsMetaType;
};

export type ExtrapolationMode = 'sampleWeighted' | 'serverOnly' | 'unspecified' | 'none';
