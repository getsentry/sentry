import {ImageFixture} from 'sentry-fixture/image';

import type {Entry, EntryDebugMeta} from 'sentry/types/event';
import type {EntryRequest} from 'sentry/types/eventBase';
import {EntryType} from 'sentry/types/eventBase';

export function EventEntryFixture(params = {}): Entry {
  return {
    type: EntryType.MESSAGE,
    data: {
      formatted: 'Blocked script',
    },
    ...params,
  };
}

export function EntryRequestFixture(params: Partial<EntryRequest> = {}): EntryRequest {
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
  params: Partial<EntryDebugMeta> = {}
): EntryDebugMeta {
  return {
    type: EntryType.DEBUGMETA,
    data: {
      images: [ImageFixture()],
    },
    ...params,
  };
}
