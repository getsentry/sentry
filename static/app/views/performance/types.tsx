import EventView from 'sentry/utils/discover/eventView';

import {QUERY_KEYS} from './utils';

export type ViewProps = Pick<EventView, (typeof QUERY_KEYS)[number]>;
