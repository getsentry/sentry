import {memo, useCallback, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {MetricQuerySelect} from 'sentry/components/metrics/metricQuerySelect';
import {
  MetricSearchBar,
  type MetricSearchBarProps,
} from 'sentry/components/metrics/metricSearchBar';
import {MRISelect} from 'sentry/components/metrics/mriSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {MRI} from 'sentry/types/metrics';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getDefaultAggregation,
  isAllowedAggregation,
  isVirtualMetric,
} from 'sentry/utils/metrics';
import {BUILT_IN_CONDITION_ID} from 'sentry/utils/metrics/extractionRules';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {QueryFieldGroup} from './queryFieldGroup';

type QueryBuilderProps = {
  index: number;
  metricsQuery: MetricsQuery;
  onChange: (data: Partial<MetricsQuery>) => void;
  projects: number[];
};

export const QueryBuilder = memo(function QueryBuilder({
  metricsQuery,
  projects: projectIds,
  onChange,
  index,
}: QueryBuilderProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {getAggregations, getConditions, resolveVirtualMRI, getTags} =
    useVirtualMetricsContext();

  const {
    data: meta,
    isLoading: isMetaLoading,
    isRefetching: isMetaRefetching,
    refetch: refetchMeta,
  } = useVirtualizedMetricsMeta(pageFilters.selection);

  const resolvedMRI = useMemo(() => {
    if (!isVirtualMetric(metricsQuery) || !metricsQuery.condition) {
      return metricsQuery.mri;
    }
    return resolveVirtualMRI(
      metricsQuery.mri,
      metricsQuery.condition,
      metricsQuery.aggregation
    ).mri;
  }, [metricsQuery, resolveVirtualMRI]);

  const {data: tagsData = [], isLoading: tagsIsLoading} = useMetricsTags(resolvedMRI, {
    projects: projectIds,
  });

  const groupByOptions = useMemo(() => {
    const options = uniqBy(tagsData, 'key').map(tag => ({
      key: tag.key,
      // So that we don't have to parse the query to determine if the tag is used
      trailingItems: metricsQuery.query?.includes(`${tag.key}:`) ? (
        <TagWarningIcon />
      ) : undefined,
      isQueryable: true, // allow group by this tag
    }));

    if (
      isVirtualMetric(metricsQuery) &&
      metricsQuery.condition &&
      metricsQuery.condition !== BUILT_IN_CONDITION_ID
    ) {
      const tagsFromExtractionRules = getTags(metricsQuery.mri, metricsQuery.condition);
      for (const tag of tagsFromExtractionRules) {
        if (!options.find(o => o.key === tag.key)) {
          // if the tag has not been seen in the selected time range
          // but exists in the extraction rule, it should be disabled in the group by dropdown
          options.push({
            key: tag.key,
            trailingItems: metricsQuery.query?.includes(`${tag.key}:`) ? (
              <TagWarningIcon />
            ) : undefined,
            isQueryable: false, // do not allow group by this tag
          });
        }
      }
    }
    return options;
  }, [tagsData, metricsQuery, getTags]);

  const selectedMeta = useMemo(() => {
    return meta.find(metric => metric.mri === metricsQuery.mri);
  }, [meta, metricsQuery.mri]);

  const metricAggregates = useMemo(() => {
    if (!isVirtualMetric(metricsQuery) || !metricsQuery.condition) {
      return selectedMeta?.operations.filter(isAllowedAggregation) ?? [];
    }

    return getAggregations(metricsQuery.mri, metricsQuery.condition).filter(
      isAllowedAggregation
    );
  }, [getAggregations, metricsQuery, selectedMeta?.operations]);

  const incrementQueryMetric = useIncrementQueryMetric({
    ...metricsQuery,
  });

  const handleMRIChange = useCallback(
    (mriValue: MRI) => {
      const currentMRI = parseMRI(metricsQuery.mri);
      const newMRI = parseMRI(mriValue);

      if (!currentMRI || !newMRI) {
        return;
      }

      const queryChanges: Partial<MetricsQuery> = {
        mri: mriValue,
        groupBy: undefined,
      };

      // If the type is the same, we can keep the current aggregate
      if (currentMRI.type !== newMRI.type) {
        queryChanges.aggregation = getDefaultAggregation(mriValue);
      }

      // If it is a virtual MRI we need to check for the new conditions and aggregations
      if (isVirtualMetric({mri: mriValue})) {
        const spanConditions = getConditions(mriValue);
        queryChanges.condition = spanConditions[0]?.id;
        const aggegates = getAggregations(mriValue, queryChanges.condition);
        queryChanges.aggregation = aggegates[0];
      } else {
        queryChanges.condition = undefined;
      }

      trackAnalytics('ddm.widget.metric', {organization});
      incrementQueryMetric('ddm.widget.metric', queryChanges);
      onChange(queryChanges);
    },
    [
      getAggregations,
      getConditions,
      incrementQueryMetric,
      metricsQuery.mri,
      onChange,
      organization,
    ]
  );

  const handleOpChange = useCallback(
    ({value}) => {
      trackAnalytics('ddm.widget.operation', {organization});
      incrementQueryMetric('ddm.widget.operation', {aggregation: value});
      onChange({
        aggregation: value,
      });
    },
    [incrementQueryMetric, onChange, organization]
  );

  const handleGroupByChange = useCallback(
    (options: SelectOption<string>[]) => {
      trackAnalytics('ddm.widget.group', {organization});
      incrementQueryMetric('ddm.widget.group', {
        groupBy: options.map(o => o.value),
      });
      onChange({
        groupBy: options.map(o => o.value),
      });
    },
    [incrementQueryMetric, onChange, organization]
  );

  const handleQueryChange = useCallback(
    (query: string) => {
      trackAnalytics('ddm.widget.filter', {organization});
      incrementQueryMetric('ddm.widget.filter', {query});

      onChange({
        query,
      });
    },
    [incrementQueryMetric, onChange, organization]
  );

  const handleConditionChange = useCallback(
    (conditionId: number) => {
      const newAggregates = getAggregations(metricsQuery.mri, conditionId);

      const changes: Partial<MetricsQuery> = {
        condition: conditionId,
        // Changing the query may change the available tags
        groupBy: undefined,
      };

      if (!newAggregates.includes(metricsQuery.aggregation)) {
        changes.aggregation = newAggregates[0];
      }

      onChange(changes);
    },
    [getAggregations, metricsQuery.aggregation, metricsQuery.mri, onChange]
  );

  const handleMetricTagClick = useCallback(
    (mri: MRI, tag: string) => {
      onChange({mri, groupBy: [tag]});
    },
    [onChange]
  );

  const handleOpenMetricsMenu = useCallback(
    (isOpen: boolean) => {
      if (isOpen && !isMetaLoading && !isMetaRefetching) {
        refetchMeta();
      }
    },
    [isMetaLoading, isMetaRefetching, refetchMeta]
  );

  const projectIdStrings = useMemo(() => projectIds.map(String), [projectIds]);

  return (
    <QueryBuilderWrapper metricsNewInputs={hasMetricsNewInputs(organization)}>
      {hasMetricsNewInputs(organization) && (
        <GuideAnchor target="metrics_selector" position="bottom" disabled={index !== 0}>
          <QueryFieldGroup>
            <QueryFieldGroup.Label>{t('Visualize')}</QueryFieldGroup.Label>
            <MRISelect
              onChange={handleMRIChange}
              onTagClick={handleMetricTagClick}
              onOpenMenu={handleOpenMetricsMenu}
              isLoading={isMetaLoading}
              metricsMeta={meta}
              projects={projectIds}
              value={metricsQuery.mri}
            />
          </QueryFieldGroup>
        </GuideAnchor>
      )}
      <FlexBlock>
        {!hasMetricsNewInputs(organization) && (
          <FlexBlock>
            <GuideAnchor
              target="metrics_selector"
              position="bottom"
              disabled={index !== 0}
            >
              <MRISelect
                onChange={handleMRIChange}
                onTagClick={handleMetricTagClick}
                onOpenMenu={handleOpenMetricsMenu}
                isLoading={isMetaLoading}
                metricsMeta={meta}
                projects={projectIds}
                value={metricsQuery.mri}
              />
            </GuideAnchor>
            {selectedMeta && isVirtualMetric(selectedMeta) ? (
              <MetricQuerySelect
                mri={metricsQuery.mri}
                conditionId={metricsQuery.condition}
                onChange={handleConditionChange}
              />
            ) : null}
          </FlexBlock>
        )}
        <FlexBlock>
          <GuideAnchor
            target="metrics_aggregate"
            position="bottom"
            disabled={index !== 0}
          >
            {hasMetricsNewInputs(organization) ? (
              <QueryFieldGroup>
                <QueryFieldGroup.Label>{t('Agg by')}</QueryFieldGroup.Label>
                <QueryFieldGroup.CompactSelect
                  size="md"
                  options={
                    metricAggregates.map(aggregation => ({
                      label: aggregation,
                      value: aggregation,
                    })) ?? []
                  }
                  triggerLabel={metricsQuery.aggregation}
                  disabled={!selectedMeta}
                  value={metricsQuery.aggregation}
                  onChange={handleOpChange}
                  css={aggregationFieldCss}
                />
              </QueryFieldGroup>
            ) : (
              <CompactSelect
                size="md"
                triggerProps={{prefix: t('Agg')}}
                options={
                  metricAggregates.map(aggregation => ({
                    label: aggregation,
                    value: aggregation,
                  })) ?? []
                }
                triggerLabel={metricsQuery.aggregation}
                disabled={!selectedMeta}
                value={metricsQuery.aggregation}
                onChange={handleOpChange}
                css={aggregationFieldCss}
              />
            )}
          </GuideAnchor>
          <GuideAnchor target="metrics_groupby" position="bottom" disabled={index !== 0}>
            {hasMetricsNewInputs(organization) ? (
              <QueryFieldGroup>
                <QueryFieldGroup.Label>{t('Group by')}</QueryFieldGroup.Label>
                <QueryFieldGroup.CompactSelect
                  multiple
                  size="md"
                  options={groupByOptions.map(tag => ({
                    label: tag.key,
                    value: tag.key,
                    disabled: !tag.isQueryable,
                    tooltip: !tag.isQueryable
                      ? t(
                          'You can not group by a tag that has not been seen in the selected time range'
                        )
                      : undefined,
                  }))}
                  disabled={!metricsQuery.mri || tagsIsLoading}
                  value={metricsQuery.groupBy}
                  onChange={handleGroupByChange}
                />
              </QueryFieldGroup>
            ) : (
              <CompactSelect
                multiple
                size="md"
                triggerProps={{prefix: t('Group by')}}
                options={groupByOptions.map(tag => ({
                  label: tag.key,
                  value: tag.key,
                  disabled: !tag.isQueryable,
                  tooltip: !tag.isQueryable
                    ? t(
                        'You can not group by a tag that has not been seen in the selected time range'
                      )
                    : undefined,
                }))}
                disabled={!metricsQuery.mri || tagsIsLoading}
                value={metricsQuery.groupBy}
                onChange={handleGroupByChange}
              />
            )}
          </GuideAnchor>
        </FlexBlock>
      </FlexBlock>
      {hasMetricsNewInputs(organization) ? (
        selectedMeta && isVirtualMetric(selectedMeta) ? (
          <QueryFieldGroup>
            <QueryFieldGroup.Label>{t('Where')}</QueryFieldGroup.Label>
            <MetricQuerySelect
              mri={metricsQuery.mri}
              conditionId={metricsQuery.condition}
              onChange={handleConditionChange}
            />
            <QueryFieldGroup.Label>{t('And')}</QueryFieldGroup.Label>
            <SearchBar
              mri={resolvedMRI}
              disabled={!metricsQuery.mri}
              onChange={handleQueryChange}
              query={metricsQuery.query}
              projectIds={projectIdStrings}
              blockedTags={
                selectedMeta?.blockingStatus?.flatMap(s => s.blockedTags) ?? []
              }
            />
          </QueryFieldGroup>
        ) : (
          <QueryFieldGroup>
            <QueryFieldGroup.Label>{t('Where')}</QueryFieldGroup.Label>
            <SearchBar
              mri={resolvedMRI}
              disabled={!metricsQuery.mri}
              onChange={handleQueryChange}
              query={metricsQuery.query}
              projectIds={projectIdStrings}
              blockedTags={
                selectedMeta?.blockingStatus?.flatMap(s => s.blockedTags) ?? []
              }
            />
          </QueryFieldGroup>
        )
      ) : (
        <SearchBar
          mri={resolvedMRI}
          disabled={!metricsQuery.mri}
          onChange={handleQueryChange}
          query={metricsQuery.query}
          projectIds={projectIdStrings}
          blockedTags={selectedMeta?.blockingStatus?.flatMap(s => s.blockedTags) ?? []}
        />
      )}
    </QueryBuilderWrapper>
  );
});

function SearchBar(props: MetricSearchBarProps) {
  return (
    <SearchBarWrapper>
      <MetricSearchBar {...props} />
    </SearchBarWrapper>
  );
}

function TagWarningIcon() {
  return (
    <TooltipIconWrapper>
      <Tooltip
        title={t('This tag appears in filter conditions, some groups may be omitted.')}
      >
        <IconWarning size="xs" color="warning" />
      </Tooltip>
    </TooltipIconWrapper>
  );
}

const TooltipIconWrapper = styled('span')`
  margin-top: ${p => p.theme.space(0.25)};
`;

const QueryBuilderWrapper = styled('div')<{metricsNewInputs: boolean}>`
  display: flex;
  flex-grow: 1;
  gap: ${p => p.theme.space(1)};
  flex-wrap: wrap;
  ${p =>
    p.metricsNewInputs &&
    css`
      @media (min-width: ${p.theme.breakpoints.xxlarge}) {
        > *:first-child {
          flex-grow: 0;
        }
      }
    `}
`;

const FlexBlock = styled('div')`
  display: flex;
  gap: ${p => p.theme.space(1)};
  flex-wrap: wrap;
`;

const SearchBarWrapper = styled('div')`
  flex: 1;
  min-width: 200px;
`;

const aggregationFieldCss = css`
  /* makes selects from different have the same width which is enough to fit all agg options except "count_unique" */
  min-width: 128px;
  & > button {
    width: 100%;
  }
`;
