import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {defaultConfig, InvalidReason} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {SavedSearchType} from 'sentry/types/group';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {GetTagValues} from 'sentry/views/dashboards/datasetConfig/base';
import {
  SESSION_STATUSES,
  SESSIONS_FILTER_TAGS,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';

const filterKeySections: FilterKeySection[] = [
  {value: 'session_field', label: t('Suggested'), children: SESSIONS_FILTER_TAGS},
];

const supportedTags = Object.values(SESSIONS_FILTER_TAGS).reduce<TagCollection>(
  (acc, key) => {
    acc[key] = {key, name: key};
    return acc;
  },
  {}
);

const invalidMessages = {
  ...defaultConfig.invalidMessages,
  [InvalidReason.WILDCARD_NOT_ALLOWED]: t("Release queries don't support wildcards."),
  [InvalidReason.FREE_TEXT_NOT_ALLOWED]: t(
    "Release queries don't support free text search."
  ),
};

export function ReleaseSearchBar({
  projectIds,
  initialQuery,
  onClose,
  onSearch,
}: DetectorSearchBarProps) {
  const organization = useOrganization();
  const api = useApi();

  const getTagValues: GetTagValues = (tag, searchQuery) => {
    if (tag.name === 'session.status') {
      return Promise.resolve(SESSION_STATUSES);
    }
    const projectIdStrings = projectIds?.map(String);
    return fetchTagValues({
      api,
      orgSlug: organization.slug,
      tagKey: tag.key,
      search: searchQuery,
      projectIds: projectIdStrings,
      includeTransactions: true,
    }).then(
      tagValues => tagValues.map(({value}) => value),
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
  };

  return (
    <SearchQueryBuilder
      initialQuery={initialQuery}
      filterKeySections={filterKeySections}
      filterKeys={supportedTags}
      getTagValues={getTagValues}
      placeholder={t('Search for release version, session status, and more')}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      onSearch={onSearch}
      searchSource="detectors"
      disallowWildcard
      disallowUnsupportedFilters
      disallowFreeText
      invalidMessages={invalidMessages}
      recentSearches={SavedSearchType.SESSION}
    />
  );
}
