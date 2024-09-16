import {useCallback, useMemo} from 'react';
import {css, type SerializedStyles} from '@emotion/react';
import {useId} from '@react-aria/utils';

import {QueryFieldGroup} from 'sentry/components/metrics/queryFieldGroup';
import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import type {MRI} from 'sentry/types/metrics';
import {
  hasMetricsNewInputs,
  hasMetricsNewSearchQueryBuilder,
} from 'sentry/utils/metrics/features';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {INSIGHTS_METRICS} from 'sentry/views/alerts/rules/metric/utils/isInsightsMetricAlert';
import {SpanMetricsField} from 'sentry/views/insights/types';
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

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set<never>();
const INSIGHTS_ADDITIONAL_TAG_FILTERS: MetricTag[] = [
  {
    key: 'has',
  },
  {
    key: SpanMetricsField.SPAN_MODULE,
  },
  {
    key: SpanMetricsField.FILE_EXTENSION,
  },
  {
    key: SpanMetricsField.SPAN_SYSTEM,
  },
  {
    key: SpanMetricsField.SPAN_GROUP,
  },
];

export function MetricSearchBar({
  mri,
  blockedTags,
  disabled,
  onChange,
  query,
  projectIds,
  id: idProp,
  ...props
}: MetricSearchBarProps) {
  const organization = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();
  const selectedProjects = useSelectedProjects();
  const id = useId(idProp);
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

  const additionalTags: MetricTag[] = useMemo(
    () =>
      // Insights metrics allow the `has` filter.
      // `span.module` is a discover field alias that does not appear in the metrics meta endpoint.
      INSIGHTS_METRICS.includes(mri as string) ? INSIGHTS_ADDITIONAL_TAG_FILTERS : [],
    [mri]
  );

  const supportedTags: TagCollection = useMemo(
    () =>
      [...tags, ...additionalTags].reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags, additionalTags]
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

      return tagsValues.filter(tv => tv.value !== '').map(tv => tv.value);
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

  const smartSearchProps: Partial<SmartSearchBarProps> & {css: SerializedStyles} = {
    id,
    disabled,
    maxMenuHeight: 220,
    organization,
    onGetTagValues: getTagValues,
    // don't highlight tags while loading as we don't know yet if they are supported
    highlightUnsupportedTags: !isPending,
    onClose: handleChange,
    onSearch: handleChange,
    placeholder: t('Filter by tags'),
    query,
    savedSearchType: SavedSearchType.METRIC,
    css: wideSearchBarCss(disabled),
    ...props,
    ...searchConfig,
  };

  if (hasMetricsNewInputs(organization)) {
    if (hasMetricsNewSearchQueryBuilder(organization)) {
      return <QueryFieldGroup.SearchQueryBuilder {...searchQueryBuilderProps} />;
    }

    return <QueryFieldGroup.SmartSearchBar {...smartSearchProps} />;
  }

  if (hasMetricsNewSearchQueryBuilder(organization)) {
    return <SearchQueryBuilder {...searchQueryBuilderProps} />;
  }

  return <SmartSearchBar {...smartSearchProps} />;
}

function wideSearchBarCss(disabled?: boolean) {
  return css`
    width: 100%;
    opacity: ${disabled ? '0.6' : '1'};
  `;
}
