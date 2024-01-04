import {ImageFixture} from 'sentry-fixture/image';

import {
  type Entry as TEntry,
  type EntryDebugMeta as TEntryDebugMeta,
  type EntryRequest as TEntryRequest,
  EntryType,
} from 'sentry/types';

export function EventEntryFixture(params = {}): TEntry {
  return {
    type: EntryType.MESSAGE,
    data: {
      formatted: 'Blocked script',
    },
    ...params,
  };
}

export function EntryRequestFixture(params: Partial<TEntryRequest> = {}): TEntryRequest {
  return {
    type: EntryType.REQUEST,
    data: {
      apiTarget: null,
      method: 'GET',
      url: '/index',
    },
    ...params,
  };
}

export function EntryDebugMetaFixture(
  params: Partial<TEntryDebugMeta> = {}
): TEntryDebugMeta {
  return {
    type: EntryType.DEBUGMETA,
    data: {
      images: [ImageFixture()],
    },
    ...params,
  };
}
