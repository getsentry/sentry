import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {Group, Tag, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {FieldKind, ISSUE_EVENT_PROPERTY_FIELDS} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {ALL_EVENTS_EXCLUDED_TAGS} from 'sentry/views/issueDetails/streamline/hooks/useEventQuery';
import {
  mergeAndSortTagValues,
  useHasStreamlinedUI,
} from 'sentry/views/issueDetails/utils';
import {makeGetIssueTagValues} from 'sentry/views/issueList/utils/getIssueTagValues';

interface EventSearchProps {
  environments: string[];
  group: Group;
  handleSearch: (value: string) => void;
  query: string;
  className?: string;
  queryBuilderProps?: Partial<SearchQueryBuilderProps>;
}

function getFilterKeySections(tags: TagCollection): FilterKeySection[] {
  const allTags: Tag[] = Object.values(tags).filter(
    tag => !ALL_EVENTS_EXCLUDED_TAGS.includes(tag.key)
  );
  const eventFields = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.EVENT_FIELD),
    ['key']
  ).map(tag => tag.key);
  const eventTags = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.TAG),
    ['totalValues', 'key'],
    ['desc', 'asc']
  ).map(tag => tag.key);

  return [
    {
      value: FieldKind.EVENT_FIELD,
      label: t('Event Filters'),
      children: eventFields,
    },
    {
      value: FieldKind.TAG,
      label: t('Event Tags'),
      children: eventTags,
    },
  ];
}

export function EventSearch({
  className,
  query,
  group,
  environments,
  handleSearch,
  queryBuilderProps = {},
}: EventSearchProps) {
  const api = useApi();
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();

  const groupTagsQuery = useGroupTags(
    {groupId: group.id, environment: environments},
    {enabled: true}
  );

  const filterKeys = useMemo<TagCollection>(() => {
    const acc: TagCollection = {};
    const keys = ISSUE_EVENT_PROPERTY_FIELDS.filter(
      tag => !ALL_EVENTS_EXCLUDED_TAGS.includes(tag)
    );
    for (const key of keys) {
      acc[key] = {key, name: key, kind: FieldKind.EVENT_FIELD};
    }
    const groupTags = groupTagsQuery.data ?? [];
    for (const tag of groupTags) {
      if (ALL_EVENTS_EXCLUDED_TAGS.includes(tag.key)) {
        continue;
      }
      acc[tag.key] = {
        key: tag.key,
        name: tag.name,
        totalValues: tag.totalValues,
        kind: FieldKind.TAG,
      };
    }
    return acc;
  }, [groupTagsQuery.data]);

  const tagValueLoader = useCallback(
    async (key: string, search: string) => {
      const orgSlug = organization.slug;
      const projectIds = [group.project.id];

      const [eventsDatasetValues, issuePlatformDatasetValues] = await Promise.all([
        fetchTagValues({
          api,
          orgSlug,
          tagKey: key,
          search,
          projectIds,
          dataset: Dataset.ERRORS,
        }),
        fetchTagValues({
          api,
          orgSlug,
          tagKey: key,
          search,
          projectIds,
          dataset: Dataset.ISSUE_PLATFORM,
        }),
      ]);

      return mergeAndSortTagValues(eventsDatasetValues, issuePlatformDatasetValues);
    },
    [api, group.project.id, organization.slug]
  );

  const getTagValues = useMemo(
    () => makeGetIssueTagValues(tagValueLoader),
    [tagValueLoader]
  );

  const filterKeySections = useMemo(() => getFilterKeySections(filterKeys), [filterKeys]);

  const experimentSearchSource = hasStreamlinedUI
    ? 'new_org_issue_details_header'
    : 'new_org_issue_events_tab';

  const searchSource = defined(organization.streamlineOnly)
    ? experimentSearchSource
    : hasStreamlinedUI
      ? 'issue_details_header'
      : 'issue_events_tab';

  return (
    <SearchQueryBuilder
      initialQuery={query}
      onSearch={handleSearch}
      filterKeys={filterKeys}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
      placeholder={hasStreamlinedUI ? t('Filter events\u2026') : t('Search events\u2026')}
      label={hasStreamlinedUI ? t('Filter events\u2026') : t('Search events')}
      searchSource={searchSource}
      className={className}
      {...queryBuilderProps}
    />
  );
}
