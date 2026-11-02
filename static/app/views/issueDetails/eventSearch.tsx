import {useCallback, useMemo} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import orderBy from 'lodash/orderBy';

import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {Group, Tag, TagCollection} from 'sentry/types/group';
import {FieldKind, ISSUE_EVENT_PROPERTY_FIELDS} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {ALL_EVENTS_EXCLUDED_TAGS} from 'sentry/views/issueDetails/hooks/useEventQuery';
import {fetchIssueTagValues} from 'sentry/views/issueDetails/utils';
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
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const groupTagsQuery = useGroupTags({groupId: group.id, environment: environments}, {});

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
    (key: string, search: string) =>
      fetchIssueTagValues(queryClient, {
        orgSlug: organization.slug,
        tagKey: key,
        search,
        projectIds: [group.project.id],
      }),
    [group.project.id, organization.slug, queryClient]
  );

  const getTagValues = useMemo(
    () => makeGetIssueTagValues(tagValueLoader),
    [tagValueLoader]
  );

  const filterKeySections = useMemo(() => getFilterKeySections(filterKeys), [filterKeys]);

  return (
    <SearchQueryBuilder
      initialQuery={query}
      onSearch={handleSearch}
      filterKeys={filterKeys}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
      placeholder={t('Filter events\u2026')}
      label={t('Filter events\u2026')}
      searchSource="issue_details_header"
      className={className}
      {...queryBuilderProps}
    />
  );
}
