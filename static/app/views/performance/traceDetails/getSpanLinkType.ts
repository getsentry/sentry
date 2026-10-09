import {SEARCH_SENTRY__LINK__TYPE} from '@sentry/conventions/attributes/search';

import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import type {TraceItemResponseLink} from 'sentry/views/explore/hooks/useTraceItemDetails';

/** The type the SDK set on a span link, e.g. `previous_trace` or `cache_origin`. */
export function getSpanLinkType(link: TraceItemResponseLink): string | undefined {
  return getAttributeValue(link.attributes ?? [], SEARCH_SENTRY__LINK__TYPE, 'string');
}
