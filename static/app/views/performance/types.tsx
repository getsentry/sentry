import type EventView from 'sentry/utils/discover/eventView';

import type {QUERY_KEYS} from './utils';

export type ViewProps = Pick<EventView, (typeof QUERY_KEYS)[number]>;
