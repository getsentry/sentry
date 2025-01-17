import {useCallback, useMemo} from 'react';
import {css, type SerializedStyles} from '@emotion/react';

import type {SmartSearchBarProps} from 'sentry/components/deprecatedSmartSearchBar';
import {QueryFieldGroup} from 'sentry/components/metrics/queryFieldGroup';
import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import type {MRI} from 'sentry/types/metrics';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ensureQuotedTextFilters} from 'sentry/views/metrics/utils';
import {useSelectedProjects} from 'sentry/views/metrics/utils/useSelectedProjects';

export interface MetricSearchBarProps
  extends Partial<Omit<SmartSearchBarProps, 'projectIds'>> {
  onChange: (value: string) => void;
  blockedTags?: string[];
  disabled?: boolean;
  mri?: MRI;
  projectIds?: string[];
  query?: string;
}

const EMPTY_ARRAY: any = [];
const EMPTY_SET = new Set<never>();

export function MetricSearchBar({
  mri,
  blockedTags,
  disabled,
  onChange,
  query,
  projectIds,
  ...props
}: MetricSearchBarProps) {
  const organization = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();
  const selectedProjects = useSelectedProjects();
  const projectIdNumbers = useMemo(
    () => projectIds?.map(projectId => parseInt(projectId, 10)),
    [projectIds]
  );

  const {data: tags = EMPTY_ARRAY, isPending} = useMetricsTags(
    mri,
    {
      ...selection,
      projects: projectIdNumbers,
    },
    true,
    blockedTags
  );

  const supportedTags: TagCollection = useMemo(
    // @ts-ignore TS(7006): Parameter 'acc' implicitly has an 'any' type.
    () => tags.reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags]
  );

  const searchConfig = useMemo(
    () => ({
      booleanKeys: EMPTY_SET,
      dateKeys: EMPTY_SET,
      durationKeys: EMPTY_SET,
      numericKeys: EMPTY_SET,
      percentageKeys: EMPTY_SET,
      sizeKeys: EMPTY_SET,
      textOperatorKeys: EMPTY_SET,
      supportedTags,
      disallowFreeText: true,
    }),
    [supportedTags]
  );

  const fetchTagValues = useCallback(
    (tagKey: string, search: string) => {
      return api.requestPromise(
        `/organizations/${organization.slug}/metrics/tags/${tagKey}/`,
        {
          query: {
            prefix: search,
            metric: mri,
            useCase: getUseCaseFromMRI(mri),
            project: selection.projects,
          },
        }
      );
    },
    [api, mri, organization.slug, selection.projects]
  );

  const getTagValues = useCallback(
    async (tag: any, search: string) => {
      // The tag endpoint cannot provide values for the project tag
      if (tag.key === 'project') {
        return selectedProjects.map(project => project.slug);
      }

      const tagsValues = await fetchTagValues(tag.key, search);

      return tagsValues.filter((tv: any) => tv.value !== '').map((tv: any) => tv.value);
    },
    [fetchTagValues, selectedProjects]
  );

  const handleChange = useCallback(
    (value: string, {validSearch} = {validSearch: true}) => {
      if (!validSearch) {
        return;
      }
      onChange(ensureQuotedTextFilters(value, searchConfig));
    },
    [onChange, searchConfig]
  );

  const searchQueryBuilderProps: SearchQueryBuilderProps & {css: SerializedStyles} = {
    disabled,
    onChange: (value, {queryIsValid}) => handleChange(value, {validSearch: queryIsValid}),
    placeholder: t('Filter by tags'),
    initialQuery: query ?? '',
    getTagValues,
    recentSearches: SavedSearchType.METRIC,
    // don't highlight tags while loading as we don't know yet if they are supported
    disallowUnsupportedFilters: !isPending,
    filterKeys: searchConfig.supportedTags,
    disallowFreeText: searchConfig.disallowFreeText,
    searchSource: props.searchSource ?? 'metrics',
    css: wideSearchBarCss(disabled),
  };

  if (hasMetricsNewInputs(organization)) {
    return <QueryFieldGroup.SearchQueryBuilder {...searchQueryBuilderProps} />;
  }

  return <SearchQueryBuilder {...searchQueryBuilderProps} />;
}

function wideSearchBarCss(disabled?: boolean) {
  return css`
    width: 100%;
    opacity: ${disabled ? '0.6' : '1'};
  `;
}
