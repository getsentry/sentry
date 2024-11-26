import {fetchTagValues} from 'sentry/actionCreators/tags';
import type {SearchBarProps} from 'sentry/components/events/searchBar';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagValue} from 'sentry/types/group';
import {SavedSearchType} from 'sentry/types/group';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {WidgetQuery} from 'sentry/views/dashboards/types';

import {SESSION_STATUSES, SESSIONS_FILTER_TAGS} from '../../releaseWidget/fields';

const filterKeySections: FilterKeySection[] = [
  {value: 'session_field', label: t('Suggested'), children: SESSIONS_FILTER_TAGS},
];

const supportedTags = Object.values(SESSIONS_FILTER_TAGS).reduce((acc, key) => {
  acc[key] = {key, name: key};
  return acc;
}, {});

const invalidMessages = {
  [InvalidReason.WILDCARD_NOT_ALLOWED]: t("Release queries don't support wildcards."),
  [InvalidReason.FREE_TEXT_NOT_ALLOWED]: t(
    "Release queries don't support free text search."
  ),
};

interface Props {
  onClose: SearchBarProps['onClose'];
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
}

export function ReleaseSearchBar({pageFilters, widgetQuery, onClose}: Props) {
  const organization = useOrganization();
  const orgSlug = organization.slug;
  const projectIds = pageFilters.projects;

  const api = useApi();

  function getTagValues(tag: Tag, searchQuery: string): Promise<string[]> {
    if (tag.name === 'session.status') {
      return Promise.resolve(SESSION_STATUSES);
    }
    const projectIdStrings = projectIds?.map(String);
    return fetchTagValues({
      api,
      orgSlug,
      tagKey: tag.key,
      search: searchQuery,
      projectIds: projectIdStrings,
      includeTransactions: true,
    }).then(
      tagValues => (tagValues as TagValue[]).map(({value}) => value),
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
  }

  return (
    <SearchQueryBuilder
      initialQuery={widgetQuery.conditions}
      filterKeySections={filterKeySections}
      filterKeys={supportedTags}
      getTagValues={getTagValues}
      placeholder={t('Search for release version, session status, and more')}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      searchSource="widget_builder"
      disallowWildcard
      disallowUnsupportedFilters
      disallowFreeText
      invalidMessages={invalidMessages}
      recentSearches={SavedSearchType.SESSION}
    />
  );
}
