import {SEARCH_LINK__TYPE} from '@sentry/conventions/attributes/search';

import {getAttributeSearchMetadata} from 'sentry/utils/fields/getAttributeSearchMetadata';
import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import type {TraceItemResponseLink} from 'sentry/views/explore/hooks/useTraceItemDetails';

// Ingest still stores the deprecated `sentry.link.type`, so match every key of the chain.
const LINK_TYPE_KEYS = getAttributeSearchMetadata(SEARCH_LINK__TYPE)
  ?.deprecationChain ?? [SEARCH_LINK__TYPE];

/** The type the SDK set on a span link, e.g. `previous_trace` or `cache_origin`. */
export function getSpanLinkType(link: TraceItemResponseLink): string | undefined {
  return getAttributeValue(link.attributes ?? [], SEARCH_LINK__TYPE, 'string');
}

export function isSpanLinkTypeAttribute(name: string): boolean {
  return LINK_TYPE_KEYS.includes(name);
}
