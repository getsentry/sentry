import type {Location} from 'history';

import {
  type ContextItem,
  getOrderedContextItems,
} from 'sentry/components/events/contexts';
import {
  getContextTitle,
  getContextType,
  getFormattedContextData,
} from 'sentry/components/events/contexts/utils';
import type {TagTreeContent} from 'sentry/components/events/eventTags/eventTagsTree';
import {t} from 'sentry/locale';
import type {Event, EventTagWithMeta} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';

export type HighlightTags = Required<Project>['highlightTags'];
export type HighlightContext = Required<Project>['highlightContext'];

interface ContextData extends ContextItem {
  data: KeyValueListData;
}

export const EMPTY_HIGHLIGHT_DEFAULT = '--';
export const HIGHLIGHT_DOCS_LINK =
  'https://docs.sentry.io/product/issues/issue-details/#event-highlights';

/**
 * Helper function to use try HighlightContext saved values on multiple fields improve match rate.
 * E.g. Matching 'os' on 'client_os', and 'Operating System', matching 'trace_id' on 'Trace ID'
 */
function getFuzzyHighlightContext(
  highlightContext: HighlightContext,
  {alias, type: contextType, value, data}: ContextData
) {
  const highlightContextSets: Record<ContextData['type'], Set<string>> = Object.entries(
    highlightContext
  ).reduce(
    (hcSets, [ctxType, contextKeys]) => ({
      ...hcSets,
      [ctxType]: new Set(contextKeys),
    }),
    {}
  );
  const title = getContextTitle({alias, type: contextType, value});
  let highlightKey: string | undefined = undefined;
  if (highlightContextSets.hasOwnProperty(alias)) {
    highlightKey = alias;
  } else if (highlightContextSets.hasOwnProperty(contextType)) {
    highlightKey = contextType;
  } else if (highlightContextSets.hasOwnProperty(title)) {
    highlightKey = title;
  }

  if (!defined(highlightKey)) {
    return {
      highlightKey,
      highlightItems: [],
    };
  }

  const highlightContextKeys = highlightContextSets[highlightKey]!;
  const highlightItems: KeyValueListData = data.filter(
    ({key, subject}) =>
      // We match on key (e.g. 'trace_id') and subject (e.g. 'Trace ID')
      highlightContextKeys.has(key) || highlightContextKeys.has(subject)
  );

  return {
    highlightKey,
    highlightItems,
  };
}

export function getHighlightContextData({
  event,
  highlightContext,
  project,
  organization,
  location,
}: {
  event: Event;
  highlightContext: HighlightContext;
  location: Location;
  organization: Organization;
  project: Project;
}) {
  const highlightContextData: ContextData[] = Object.entries(highlightContext).map(
    ([contextType, contextKeys]) => ({
      alias: contextType,
      type: contextType,
      value: EMPTY_HIGHLIGHT_DEFAULT,
      data: contextKeys.map(
        contextKey => ({
          key: contextKey,
          subject: contextKey,
          value: EMPTY_HIGHLIGHT_DEFAULT,
        }),
        {}
      ),
    })
  );

  const eventContextData: ContextData[] = getOrderedContextItems(event).map(
    ({alias, type, value}) => ({
      alias,
      type,
      value,
      data: getFormattedContextData({
        event,
        contextType: getContextType({alias, type}),
        contextValue: value,
        organization,
        project,
        location,
      }),
    })
  );

  eventContextData.forEach(ctxData => {
    const {highlightItems, highlightKey} = getFuzzyHighlightContext(
      highlightContext,
      ctxData
    );
    if (!highlightKey || highlightItems.length === 0) {
      return;
    }
    const highlightItemKeys = new Set(highlightItems.map(item => item.key));
    const matchingHighlight = highlightContextData.find(
      hCtxData => hCtxData.type === highlightKey
    );
    if (!matchingHighlight) {
      return;
    }
    // We can't use Object.assign since the 'data' property is being mutated
    matchingHighlight.type = ctxData.type;
    matchingHighlight.value = ctxData.value;
    matchingHighlight.alias = ctxData.alias;
    matchingHighlight.data = [
      ...highlightItems,
      ...matchingHighlight.data.filter(
        emptyItem => !highlightItemKeys.has(emptyItem.key)
      ),
    ];
  });
  return highlightContextData;
}

export function getHighlightTagData({
  event,
  highlightTags,
}: {
  event: Event;
  highlightTags: HighlightTags;
}): Array<Required<TagTreeContent>> {
  const tagMap = event.tags.reduce<Record<string, EventTagWithMeta>>((tm, tag, i) => {
    tm[tag.key] = {...tag, meta: event._meta?.tags?.[i]};
    return tm;
  }, {});
  return highlightTags.map(tagKey => ({
    subtree: {},
    meta: tagMap[tagKey]?.meta ?? {},
    value: tagMap[tagKey]?.hasOwnProperty('value')
      ? tagMap[tagKey]?.value
      : EMPTY_HIGHLIGHT_DEFAULT,
    originalTag: tagMap[tagKey] ?? {key: tagKey, value: EMPTY_HIGHLIGHT_DEFAULT},
  }));
}

/**
 * Returns a label that can be used in the Event Highlight Summary.
 * Currently only used for JavaScript-based error events.
 */
export function getRuntimeLabelAndTooltip(
  event: Event
): {label: string; tooltip: string} | null {
  if (event.type !== 'error' || !event.sdk?.name?.includes('javascript')) {
    return null;
  }

  // eslint-disable-next-line default-case
  switch (event.contexts.runtime?.name || '') {
    case 'node':
      return {label: t('Backend'), tooltip: t('Error from Node.js Server Runtime')};
    case 'bun':
      return {label: t('Backend'), tooltip: t('Error from Bun Server Runtime')};
    case 'deno':
      return {label: t('Backend'), tooltip: t('Error from Deno Server Runtime')};
    case 'cloudflare':
      return {label: t('Backend'), tooltip: t('Error from Cloudflare Workers')};
    case 'vercel-edge':
      return {label: t('Backend'), tooltip: t('Error from Vercel Edge Runtime')};
  }

  if (event.contexts.runtime?.name) {
    // Browser events don't have a runtime context
    return {label: t('Backend'), tooltip: t('Error from Server, Edge or Worker Runtime')};
  }

  if (event.contexts.browser) {
    // Backend events might also have a browser context
    const browserName = event.contexts.browser.name || 'browser';
    return {label: t('Frontend'), tooltip: t('Error from %s browser', browserName)};
  }

  return null;
}
