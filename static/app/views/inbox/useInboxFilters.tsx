import {parseAsNativeArrayOf, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {INBOX_EVENT_TYPES, INBOX_SUBJECT_TYPES} from './types';

const inboxFilterParsers = {
  subjectType: parseAsNativeArrayOf(parseAsStringLiteral(INBOX_SUBJECT_TYPES)),
  eventType: parseAsNativeArrayOf(parseAsStringLiteral(INBOX_EVENT_TYPES)),
};

export function useInboxFilters() {
  return useQueryStates(inboxFilterParsers);
}

export type SetInboxFilters = ReturnType<typeof useInboxFilters>[1];
