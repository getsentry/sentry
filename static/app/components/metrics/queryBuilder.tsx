import {memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {MetricSearchBar} from 'sentry/components/metrics/metricSearchBar';
import {MRISelect} from 'sentry/components/metrics/mriSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconInfo, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsExtractionCondition, MRI} from 'sentry/types/metrics';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDefaultAggregation, isAllowedAggregation} from 'sentry/utils/metrics';
import {DEFAULT_METRICS_CARDINALITY_LIMIT} from 'sentry/utils/metrics/constants';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useMetricsCardinality} from 'sentry/utils/metrics/useMetricsCardinality';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSelectedProjects} from 'sentry/views/metrics/utils/useSelectedProjects';
import {openExtractionRuleEditModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleEditModal';

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
  const {getConditions, getVirtualMeta, resolveVirtualMRI} = useVirtualMetricsContext();
  const {data: cardinality} = useMetricsCardinality(pageFilters.selection);

  const {
    data: meta,
    isLoading: isMetaLoading,
    isRefetching: isMetaRefetching,
    refetch: refetchMeta,
  } = useVirtualizedMetricsMeta(pageFilters.selection);

  const resolvedMRI = useMemo(() => {
    const type = parseMRI(metricsQuery.mri)?.type;
    if (type !== 'v' || !metricsQuery.condition) {
      return metricsQuery.mri;
    }
    return resolveVirtualMRI(
      metricsQuery.mri,
      metricsQuery.condition,
      metricsQuery.aggregation
    ).mri;
  }, [
    metricsQuery.aggregation,
    metricsQuery.condition,
    metricsQuery.mri,
    resolveVirtualMRI,
  ]);

  const {data: tagsData = [], isLoading: tagsIsLoading} = useMetricsTags(
    metricsQuery.mri,
    {
      projects: projectIds,
    }
  );

  const groupByOptions = useMemo(() => {
    return uniqBy(tagsData, 'key').map(tag => ({
      key: tag.key,
      // So that we don't have to parse the query to determine if the tag is used
      trailingItems: metricsQuery.query?.includes(`${tag.key}:`) ? (
        <TagWarningIcon />
      ) : undefined,
    }));
  }, [tagsData, metricsQuery.query]);

  const selectedMeta = useMemo(() => {
    return meta.find(metric => metric.mri === metricsQuery.mri);
  }, [meta, metricsQuery.mri]);

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
      if (newMRI.type === 'v') {
        const spanConditions = getConditions(mriValue);
        const virtualMeta = getVirtualMeta(mriValue);
        queryChanges.condition = spanConditions[0]?.id;
        queryChanges.aggregation = virtualMeta.operations[0];
      } else {
        queryChanges.condition = undefined;
      }

      trackAnalytics('ddm.widget.metric', {organization});
      incrementQueryMetric('ddm.widget.metric', queryChanges);
      onChange(queryChanges);
    },
    [
      getConditions,
      getVirtualMeta,
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
  const spanConditions = getConditions(metricsQuery.mri);

  const getMaxCardinality = (condition?: MetricsExtractionCondition) => {
    if (!cardinality || !condition) {
      return 0;
    }
    return condition.mris.reduce((acc, mri) => Math.max(acc, cardinality[mri] || 0), 0);
  };

  return (
    <QueryBuilderWrapper>
      <FlexBlock>
        <FlexBlock>
          <GuideAnchor target="metrics_selector" position="bottom" disabled={index !== 0}>
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
          {selectedMeta?.type === 'v' ? (
            <CompactSelect
              size="md"
              triggerProps={{
                prefix: t('Query'),
                icon:
                  getMaxCardinality(
                    spanConditions.find(c => c.id === metricsQuery.condition)
                  ) > DEFAULT_METRICS_CARDINALITY_LIMIT ? (
                    <CardinalityWarningIcon />
                  ) : null,
              }}
              options={spanConditions.map(condition => ({
                label: condition.value ? (
                  <Tooltip showOnlyOnOverflow title={condition.value} skipWrapper>
                    <QueryLabel>{condition.value}</QueryLabel>
                  </Tooltip>
                ) : (
                  t('All spans')
                ),
                trailingItems: [
                  getMaxCardinality(condition) > DEFAULT_METRICS_CARDINALITY_LIMIT ? (
                    <CardinalityWarningIcon key="cardinality-warning" />
                  ) : undefined,
                ],
                textValue: condition.value || t('All spans'),
                value: condition.id,
              }))}
              value={metricsQuery.condition}
              onChange={({value}) => {
                onChange({condition: value});
              }}
              menuFooter={({closeOverlay}) => (
                <QueryFooter mri={metricsQuery.mri} closeOverlay={closeOverlay} />
              )}
            />
          ) : null}
        </FlexBlock>
        <FlexBlock>
          <GuideAnchor
            target="metrics_aggregate"
            position="bottom"
            disabled={index !== 0}
          >
            <AggregationSelect
              size="md"
              triggerProps={{prefix: t('Agg')}}
              options={
                selectedMeta?.operations
                  .filter(isAllowedAggregation)
                  .map(aggregation => ({
                    label: aggregation,
                    value: aggregation,
                  })) ?? []
              }
              triggerLabel={metricsQuery.aggregation}
              disabled={!selectedMeta}
              value={metricsQuery.aggregation}
              onChange={handleOpChange}
            />
          </GuideAnchor>
          <GuideAnchor target="metrics_groupby" position="bottom" disabled={index !== 0}>
            <CompactSelect
              multiple
              size="md"
              triggerProps={{prefix: t('Group by')}}
              options={groupByOptions.map(tag => ({
                label: tag.key,
                value: tag.key,
              }))}
              disabled={!metricsQuery.mri || tagsIsLoading}
              value={metricsQuery.groupBy}
              onChange={handleGroupByChange}
            />
          </GuideAnchor>
        </FlexBlock>
      </FlexBlock>
      <SearchBarWrapper>
        <MetricSearchBar
          mri={resolvedMRI}
          disabled={!metricsQuery.mri}
          onChange={handleQueryChange}
          query={metricsQuery.query}
          projectIds={projectIdStrings}
          blockedTags={selectedMeta?.blockingStatus?.flatMap(s => s.blockedTags) ?? []}
        />
      </SearchBarWrapper>
    </QueryBuilderWrapper>
  );
});

function CardinalityWarningIcon() {
  return (
    <Tooltip
      isHoverable
      title={t(
        "This query is exeeding the cardinality limit. Remove tags or add more filters in the metric's settings to receive accurate data."
      )}
      skipWrapper
    >
      <IconWarning size="xs" color="yellow300" />
    </Tooltip>
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

function QueryFooter({mri, closeOverlay}) {
  const {getVirtualMeta, getExtractionRule} = useVirtualMetricsContext();
  const selectedProjects = useSelectedProjects();

  const metricMeta = getVirtualMeta(mri);
  const project = selectedProjects.find(p => p.id === String(metricMeta.projectIds[0]));

  if (!project) {
    return null;
  }
  return (
    <QueryFooterWrapper>
      <Button
        size="xs"
        icon={<IconAdd isCircled />}
        onClick={() => {
          closeOverlay();
          const extractionRule = getExtractionRule(mri);
          if (!extractionRule) {
            return;
          }
          openExtractionRuleEditModal({metricExtractionRule: extractionRule});
        }}
      >
        {t('Add Query')}
      </Button>
      <InfoWrapper>
        <Tooltip
          title={t(
            'Ideally, you can visualize span data by any property you want. However, our infrastructure has limits as well, so pretty please define in advance what you want to see.'
          )}
          skipWrapper
        >
          <IconInfo size="xs" />
        </Tooltip>
        {t('What are queries?')}
      </InfoWrapper>
    </QueryFooterWrapper>
  );
}

const TooltipIconWrapper = styled('span')`
  margin-top: ${space(0.25)};
`;

const QueryBuilderWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const FlexBlock = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const AggregationSelect = styled(CompactSelect)`
  /* makes selects from different have the same width which is enough to fit all agg options except "count_unique" */
  min-width: 128px;
  & > button {
    width: 100%;
  }
`;

const SearchBarWrapper = styled('div')`
  flex: 1;
  min-width: 200px;
`;

const QueryLabel = styled('code')`
  padding-left: 0;
  max-width: 350px;
  ${p => p.theme.overflowEllipsis}
`;

const InfoWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
`;

const QueryFooterWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 250px;
`;
