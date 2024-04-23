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

export type HighlightTags = Required<Project>['highlightTags'];
export type HighlightContext = Required<Project>['highlightContext'];

interface ContextData extends ContextItem {
  data: KeyValueListData;
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
  const highlightContextSets: Record<ContextData['type'], Set<string>> = Object.entries(
    highlightContext
  ).reduce(
    (hcSets, [contextType, contextKeys]) => ({
      ...hcSets,
      [contextType]: new Set(contextKeys),
    }),
    {}
  );

  const allContextData: ContextData[] = getOrderedContextItems(event).map(
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

  const highlightContextData: ContextData[] = allContextData
    .map(({alias, type: contextType, value, data}) => {
      // Find the highlight key set for this type of context
      // We match on alias (e.g. 'client_os'), type (e.g. 'os') and title (e.g. 'Operating System')
      const highlightContextKeys =
        highlightContextSets[alias] ??
        highlightContextSets[contextType] ??
        highlightContextSets[getContextTitle({alias, type: contextType, value})] ??
        new Set([]);
      // Filter data to only items from that set
      const highlightContextItems: KeyValueListData = data.filter(
        ({key, subject}) =>
          // We match on key (e.g. 'trace_id') and subject (e.g. 'Trace ID')
          highlightContextKeys.has(key) || highlightContextKeys.has(subject)
      );
      return {alias, type: contextType, data: highlightContextItems, value: value};
    })
    // Retain only entries with highlights
    .filter(({data}) => data.length > 0);

  return highlightContextData;
}

export function getHighlightTagData({
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
