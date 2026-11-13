import {SEARCH_PAGE__SERVER_RENDERING__TYPE} from '@sentry/conventions/attributes/search';

import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import type {
  TraceItemResponseAttribute,
  TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getSpanLinkType} from 'sentry/views/performance/traceDetails/getSpanLinkType';

/**
 * How the server rendered the page. Not set means rendered for this request,
 * or not known.
 * https://conventions.sentry.dev/attributes/page/#page-server_rendering-type
 */
export type ServerRenderingType = 'static' | 'partially_static';

/** The part of the page that a shared render made. */
export type StaticPart = 'whole_page' | 'static_part';

/** Where the spans of a render are, seen from the pageload span. */
type RenderLocation =
  | {type: 'this_trace'}
  | {link: TraceItemResponseLink; type: 'other_trace'}
  // The linked trace was not sampled, so it has no spans.
  | {link: TraceItemResponseLink; type: 'not_sampled'}
  // The page was reused, but no link points to its render.
  | {type: 'not_traced'};

export interface ServerRender {
  location: RenderLocation;
}

/** A render whose HTML the server reuses for many page loads. */
interface SharedRender extends ServerRender {
  /** `undefined` when the type is not set. */
  part: StaticPart | undefined;
}

/** At least one render is set. A page can have both. */
interface PageServerRendering {
  type: ServerRenderingType | undefined;
  /** The render for this page load's request. */
  requestRender?: ServerRender;
  sharedRender?: SharedRender;
}

const PAGELOAD_OP = 'pageload';
const CACHE_ORIGIN_LINK_TYPE = 'cache_origin';
const SERVER_REQUEST_LINK_TYPE = 'server_request';

export function getServerRenderingType(
  value: string | number | boolean | undefined
): ServerRenderingType | undefined {
  return value === 'static' || value === 'partially_static' ? value : undefined;
}

function toLinkedLocation(link: TraceItemResponseLink): RenderLocation {
  // A link without a sampling decision counts as sampled.
  return link.sampled === false
    ? {type: 'not_sampled', link}
    : {type: 'other_trace', link};
}

export function getStaticPart(type: ServerRenderingType): StaticPart {
  return type === 'static' ? 'whole_page' : 'static_part';
}

/**
 * The server renders that made a pageload's page, and where their spans are.
 * Uses only span attributes and links, so it works for every SDK and framework.
 * Returns `null` for other spans and for pages rendered only for this request.
 */
export function getPageServerRendering({
  op,
  attributes,
  links,
}: {
  attributes: TraceItemResponseAttribute[];
  op: string | undefined;
  links?: TraceItemResponseLink[];
}): PageServerRendering | null {
  if (op !== PAGELOAD_OP) {
    return null;
  }

  const type = getServerRenderingType(
    getAttributeValue(attributes, SEARCH_PAGE__SERVER_RENDERING__TYPE, 'string')
  );
  const cacheOrigin = findLinkOfType(links, CACHE_ORIGIN_LINK_TYPE);
  const serverRequest = findLinkOfType(links, SERVER_REQUEST_LINK_TYPE);

  const sharedRender = getSharedRender(type, cacheOrigin);
  const requestRender = getRequestRender(type, serverRequest);

  if (!sharedRender && !requestRender) {
    return null;
  }
  return {type, sharedRender, requestRender};
}

function findLinkOfType(
  links: TraceItemResponseLink[] | undefined,
  type: string
): TraceItemResponseLink | undefined {
  return links?.find(link => getSpanLinkType(link) === type);
}

/** A `cache_origin` link or a static type means the server reused HTML. */
function getSharedRender(
  type: ServerRenderingType | undefined,
  cacheOrigin: TraceItemResponseLink | undefined
): SharedRender | undefined {
  if (!type && !cacheOrigin) {
    return undefined;
  }
  return {
    part: type ? getStaticPart(type) : undefined,
    location: cacheOrigin ? toLinkedLocation(cacheOrigin) : {type: 'not_traced'},
  };
}

/**
 * A `server_request` link means the request has its own trace, because its
 * trace ID arrived after the pageload started.
 */
function getRequestRender(
  type: ServerRenderingType | undefined,
  serverRequest: TraceItemResponseLink | undefined
): ServerRender | undefined {
  if (serverRequest) {
    return {location: toLinkedLocation(serverRequest)};
  }
  // The dynamic part of a partially static page renders for each request.
  return type === 'partially_static' ? {location: {type: 'this_trace'}} : undefined;
}
