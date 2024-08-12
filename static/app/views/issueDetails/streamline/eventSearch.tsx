import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {useFetchIssueTags} from 'sentry/actionCreators/group';
import {Dataset, fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {Group, Tag, TagCollection} from 'sentry/types/group';
import {FieldKind, ISSUE_EVENT_PROPERTY_FIELDS} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {ALL_EVENTS_EXCLUDED_TAGS} from 'sentry/views/issueDetails/groupEvents';
import {mergeAndSortTagValues} from 'sentry/views/issueDetails/utils';
import {makeGetIssueTagValues} from 'sentry/views/issueList/utils/getIssueTagValues';

interface EventSearchProps {
  environments: string[];
  group: Group;
  handleSearch: (value: string) => void;
  query: string;
  className?: string;
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
}: EventSearchProps) {
  const api = useApi();
  const organization = useOrganization();

  const {data = []} = useFetchIssueTags({
    orgSlug: organization.slug,
    groupId: group.id,
    environment: environments,
  });

  const filterKeys = useMemo<TagCollection>(() => {
    const tags = [
      ...data.map(tag => ({...tag, kind: FieldKind.TAG})),
      ...ISSUE_EVENT_PROPERTY_FIELDS.map(tag => ({
        key: tag,
        name: tag,
        kind: FieldKind.EVENT_FIELD,
      })),
    ].filter(tag => !ALL_EVENTS_EXCLUDED_TAGS.includes(tag.key));

    return tags.reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = tag;
      return acc;
    }, {});
  }, [data]);

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

  return (
    <SearchQueryBuilder
      initialQuery={query}
      onSearch={handleSearch}
      filterKeys={filterKeys}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
      placeholder={t('Search events...')}
      searchSource="issue_events_tab"
      className={className}
    />
  );
}
