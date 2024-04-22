import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {getFormattedContextData} from 'sentry/components/events/contexts/utils';
import type {TagTreeContent} from 'sentry/components/events/eventTags/eventTagsTree';
import type {
  Event,
  EventTag,
  KeyValueListData,
  Organization,
  Project,
} from 'sentry/types';

export type HighlightTags = Required<Project>['highlightTags'];
export type HighlightContext = Required<Project>['highlightContext'];

export function getHighlightContextItems({
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
  const highlightContextSets: Record<string, Set<string>> = Object.entries(
    highlightContext
  ).reduce(
    (hcSets, [contextType, contextKeys]) => ({
      ...hcSets,
      [contextType]: new Set(contextKeys),
    }),
    {}
  );
  const allContextDataMap: Record<string, {contextType: string; data: KeyValueListData}> =
    getOrderedContextItems(event).reduce((ctxMap, [alias, contextValue]) => {
      ctxMap[alias] = {
        contextType: contextValue.type,
        data: getFormattedContextData({
          event,
          contextType: contextValue.type,
          contextValue,
          organization,
          project,
        }),
      };
      return ctxMap;
    }, {});
  // 2D Array of highlighted context data. We flatten it because
  const highlightContextDataItems: [alias: string, KeyValueListData][] = Object.entries(
    allContextDataMap
  ).map(([alias, {contextType, data}]) => {
    // Find the key set from highlight preferences
    const highlightContextKeys =
      highlightContextSets[alias] ?? highlightContextSets[contextType] ?? new Set([]);
    // Filter to only items from that set
    const highlightContextData: KeyValueListData = data.filter(
      ({key, subject}) =>
        // Need to do both since they differ
        highlightContextKeys.has(key) || highlightContextKeys.has(subject)
    );
    return [alias, highlightContextData];
  });

  return highlightContextDataItems;
}

export function getHighlightTagItems({
  event,
  highlightTags,
}: {
  event: Event;
  highlightTags: HighlightTags;
}): Required<TagTreeContent>[] {
  const EMPTY_TAG_VALUE = '';
  const tagMap: Record<string, {meta: Record<string, any>; tag: EventTag}> =
    event.tags.reduce((tm, tag, i) => {
      tm[tag.key] = {tag, meta: event._meta?.tags?.[i]};
      return tm;
    }, {});
  return highlightTags.map(tagKey => ({
    subtree: {},
    meta: tagMap[tagKey]?.meta ?? {},
    value: tagMap[tagKey]?.tag?.value ?? EMPTY_TAG_VALUE,
    originalTag: tagMap[tagKey]?.tag ?? {key: tagKey, value: EMPTY_TAG_VALUE},
  }));
}
