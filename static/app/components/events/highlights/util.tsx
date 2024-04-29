import {
  type ContextItem,
  getOrderedContextItems,
} from 'sentry/components/events/contexts';
import {
  getContextTitle,
  getFormattedContextData,
} from 'sentry/components/events/contexts/utils';
import type {TagTreeContent} from 'sentry/components/events/eventTags/eventTagsTree';
import type {
  Event,
  EventTag,
  KeyValueListData,
  Organization,
  Project,
} from 'sentry/types';
import {defined} from 'sentry/utils';

export type HighlightTags = Required<Project>['highlightTags'];
export type HighlightContext = Required<Project>['highlightContext'];

interface ContextData extends ContextItem {
  data: KeyValueListData;
}

export const EMPTY_HIGHLIGHT_DEFAULT = '--';

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

  const highlightContextKeys = highlightContextSets[highlightKey];
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
}: {
  event: Event;
  highlightContext: HighlightContext;
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
        contextType: type,
        contextValue: value,
        organization,
        project,
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
}): Required<TagTreeContent>[] {
  const tagMap: Record<string, {meta: Record<string, any>; tag: EventTag}> =
    event.tags.reduce((tm, tag, i) => {
      tm[tag.key] = {tag, meta: event._meta?.tags?.[i]};
      return tm;
    }, {});
  return highlightTags.map(tagKey => ({
    subtree: {},
    meta: tagMap[tagKey]?.meta ?? {},
    value: tagMap[tagKey]?.tag?.value ?? EMPTY_HIGHLIGHT_DEFAULT,
    originalTag: tagMap[tagKey]?.tag ?? {key: tagKey, value: EMPTY_HIGHLIGHT_DEFAULT},
  }));
}
