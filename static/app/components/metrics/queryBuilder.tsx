import {memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {MetricSearchBar} from 'sentry/components/metrics/metricSearchBar';
import {MRISelect} from 'sentry/components/metrics/mriSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MRI} from 'sentry/types/metrics';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDefaultAggregate, isAllowedOp} from 'sentry/utils/metrics';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

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

  const {
    data: meta,
    isLoading: isMetaLoading,
    isRefetching: isMetaRefetching,
    refetch: refetchMeta,
  } = useMetricsMeta(pageFilters.selection);

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

      let queryChanges = {};

      // If the type is the same, we can keep the current aggregate
      if (currentMRI.type === newMRI.type) {
        queryChanges = {
          mri: mriValue,
          groupBy: undefined,
        };
      } else {
        queryChanges = {
          mri: mriValue,
          op: getDefaultAggregate(mriValue),
          groupBy: undefined,
        };
      }

      trackAnalytics('ddm.widget.metric', {organization});
      incrementQueryMetric('ddm.widget.metric', queryChanges);
      onChange(queryChanges);
    },
    [incrementQueryMetric, metricsQuery.mri, onChange, organization]
  );

  const handleOpChange = useCallback(
    ({value}) => {
      trackAnalytics('ddm.widget.operation', {organization});
      incrementQueryMetric('ddm.widget.operation', {op: value});
      onChange({
        op: value,
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

  return (
    <QueryBuilderWrapper>
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
        <FlexBlock>
          <GuideAnchor
            target="metrics_aggregate"
            position="bottom"
            disabled={index !== 0}
          >
            <OpSelect
              size="md"
              triggerProps={{prefix: t('Agg')}}
              options={
                selectedMeta?.operations.filter(isAllowedOp).map(op => ({
                  label: op,
                  value: op,
                })) ?? []
              }
              triggerLabel={metricsQuery.op}
              disabled={!selectedMeta}
              value={metricsQuery.op}
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
          mri={metricsQuery.mri}
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

const OpSelect = styled(CompactSelect)`
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
