import type React from 'react';
import {memo, useCallback, useMemo} from 'react';
import {ClassNames, css} from '@emotion/react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {
  MetricSearchBar,
  type MetricSearchBarProps,
} from 'sentry/components/metrics/metricSearchBar';
import {MRISelect} from 'sentry/components/metrics/mriSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MRI} from 'sentry/types/metrics';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDefaultAggregation, isAllowedAggregation} from 'sentry/utils/metrics';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import theme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {QueryFieldGroup} from './queryFieldGroup';

type QueryBuilderProps = {
  hasSymbols: boolean;
  index: number;
  metricsQuery: MetricsQuery;
  onChange: (data: Partial<MetricsQuery>) => void;
  projects: number[];
  alias?: React.ReactNode;
  isModal?: boolean;
};

export const QueryBuilder = memo(function QueryBuilder({
  metricsQuery,
  projects: projectIds,
  onChange,
  index,
  hasSymbols,
  alias,
  isModal,
}: QueryBuilderProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  const {
    data: meta,
    isLoading: isMetaLoading,
    isRefetching: isMetaRefetching,
    refetch: refetchMeta,
  } = useVirtualizedMetricsMeta(pageFilters.selection);

  const {data: tagsData = [], isPending: tagsIsLoading} = useMetricsTags(
    metricsQuery.mri,
    {
      projects: projectIds,
    }
  );

  const groupByOptions = useMemo(() => {
    const options = uniqBy(tagsData, 'key').map(tag => ({
      key: tag.key,
      // So that we don't have to parse the query to determine if the tag is used
      trailingItems: metricsQuery.query?.includes(`${tag.key}:`) ? (
        <TagWarningIcon />
      ) : undefined,
      isQueryable: true, // allow group by this tag
    }));

    return options;
  }, [tagsData, metricsQuery]);

  const selectedMeta = useMemo(() => {
    return meta.find(metric => metric.mri === metricsQuery.mri);
  }, [meta, metricsQuery.mri]);

  const metricAggregates = useMemo(() => {
    return selectedMeta?.operations.filter(isAllowedAggregation) ?? [];
  }, [selectedMeta?.operations]);

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
      queryChanges.condition = undefined;

      trackAnalytics('ddm.widget.metric', {organization});
      incrementQueryMetric('ddm.widget.metric', queryChanges);
      onChange(queryChanges);
    },
    [incrementQueryMetric, metricsQuery.mri, onChange, organization]
  );

  const handleOpChange = useCallback(
    ({value}: any) => {
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

  if (hasMetricsNewInputs(organization)) {
    return (
      <QueryBuilderWrapper metricsNewInputs hasSymbols={hasSymbols} isModal={isModal}>
        <Visualize isModal={isModal}>
          <FullWidthGuideAnchor
            target="metrics_selector"
            position="bottom"
            disabled={index !== 0}
          >
            <QueryFieldGroup>
              <QueryFieldGroup.Label css={fixedWidthLabelCss}>
                {t('Visualize')}
              </QueryFieldGroup.Label>
              <MRISelect
                onChange={handleMRIChange}
                onTagClick={handleMetricTagClick}
                onOpenMenu={handleOpenMetricsMenu}
                isLoading={isMetaLoading}
                metricsMeta={meta}
                projects={projectIds}
                value={metricsQuery.mri}
                isModal={isModal}
              />
            </QueryFieldGroup>
          </FullWidthGuideAnchor>
        </Visualize>
        <Aggregate>
          <FullWidthGuideAnchor
            target="metrics_aggregate"
            position="bottom"
            disabled={index !== 0}
          >
            <QueryFieldGroup>
              <QueryFieldGroup.Label css={fixedWidthLabelCss}>
                {t('Agg by')}
              </QueryFieldGroup.Label>
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
                css={css`
                  /* makes selects from different have the same width which is enough to fit all agg options except "count_unique" */
                  min-width: 128px;
                  && {
                    width: 100%;
                  }
                  & > button {
                    width: 100%;
                  }
                `}
              />
            </QueryFieldGroup>
          </FullWidthGuideAnchor>
        </Aggregate>
        <GroupBy>
          <FullWidthGuideAnchor
            target="metrics_groupby"
            position="bottom"
            disabled={index !== 0}
          >
            <QueryFieldGroup>
              <QueryFieldGroup.Label css={fixedWidthLabelCss}>
                {t('Group by')}
              </QueryFieldGroup.Label>
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
          </FullWidthGuideAnchor>
        </GroupBy>
        <FilterBy hasSymbols={hasSymbols} isModal={isModal}>
          <FullWidthGuideAnchor
            target="metrics_filterby"
            position="bottom"
            disabled={index !== 0}
          >
            <QueryFieldGroup>
              <QueryFieldGroup.Label css={fixedWidthLabelCss}>
                {t('Where')}
              </QueryFieldGroup.Label>
              <SearchBar
                hasMetricsNewInputs
                mri={metricsQuery.mri}
                disabled={!metricsQuery.mri}
                onChange={handleQueryChange}
                query={metricsQuery.query}
                projectIds={projectIdStrings}
                blockedTags={
                  selectedMeta?.blockingStatus?.flatMap(s => s.blockedTags) ?? []
                }
              />
            </QueryFieldGroup>
          </FullWidthGuideAnchor>
        </FilterBy>
        {alias}
      </QueryBuilderWrapper>
    );
  }

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
        </FlexBlock>
        <FlexBlock>
          <GuideAnchor
            target="metrics_aggregate"
            position="bottom"
            disabled={index !== 0}
          >
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
              css={css`
                /* makes selects from different have the same width which is enough to fit all agg options except "count_unique" */
                min-width: 128px;
                & > button {
                  width: 100%;
                }
              `}
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
          </GuideAnchor>
        </FlexBlock>
      </FlexBlock>
      <SearchBar
        mri={metricsQuery.mri}
        disabled={!metricsQuery.mri}
        onChange={handleQueryChange}
        query={metricsQuery.query}
        projectIds={projectIdStrings}
        blockedTags={selectedMeta?.blockingStatus?.flatMap(s => s.blockedTags) ?? []}
      />
    </QueryBuilderWrapper>
  );
});

function SearchBar({
  hasMetricsNewInputs: metricsNewInputs = false,
  ...props
}: MetricSearchBarProps & {hasMetricsNewInputs?: boolean}) {
  return (
    <SearchBarWrapper hasMetricsNewInputs={metricsNewInputs}>
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

function FullWidthGuideAnchor(props: React.ComponentProps<typeof GuideAnchor>) {
  return (
    <ClassNames>
      {({css: classNamesCss}) => (
        <GuideAnchor
          {...props}
          containerClassName={classNamesCss`
            width: 100%;
          `}
        />
      )}
    </ClassNames>
  );
}

const TooltipIconWrapper = styled('span')`
  margin-top: ${space(0.25)};
`;

const QueryBuilderWrapper = styled('div')<{
  hasSymbols?: boolean;
  isModal?: boolean;
  metricsNewInputs?: boolean;
}>`
  display: flex;
  flex-grow: 1;
  gap: ${space(1)};
  flex-wrap: wrap;

  ${p =>
    p.metricsNewInputs &&
    css`
      display: grid;
      grid-template-columns: subgrid;
      gap: ${space(1)};
      align-items: flex-start;
      grid-column-start: ${p.hasSymbols ? '2' : '1'};

      @media (min-width: ${p.theme.breakpoints.small}) {
        grid-column-end: ${p.hasSymbols ? '4' : '3'};
      }

      ${!p.isModal &&
      css`
        @media (min-width: ${p.theme.breakpoints.large}) {
          grid-column-end: ${p.hasSymbols ? '5' : '4'};
        }
        @media (min-width: ${p.theme.breakpoints.xxlarge}) {
          grid-column-end: ${p.hasSymbols ? '6' : '5'};
        }
      `}
    `}
`;

const Visualize = styled('div')<{isModal?: boolean}>`
  grid-column: 1/-1;
  ${p =>
    !p.isModal &&
    css`
      @media (min-width: ${p.theme.breakpoints.large}) {
        grid-column: 1/1;
      }
    `}
`;

const Aggregate = styled('div')``;

const GroupBy = styled('div')``;

const FilterBy = styled('div')<{hasSymbols: boolean; isModal?: boolean}>`
  grid-column: 1/-1;
  ${p =>
    !p.isModal &&
    css`
      @media (min-width: ${p.theme.breakpoints.xxlarge}) {
        grid-column: ${p.hasSymbols ? '6/6' : '5/5'};
      }
    `}
`;

const fixedWidthLabelCss = css`
  width: 95px;
  min-width: 95px;
  white-space: nowrap;

  @media (min-width: ${theme.breakpoints.xxlarge}) {
    width: auto;
    min-width: auto;
  }
`;

const FlexBlock = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const SearchBarWrapper = styled('div')<{hasMetricsNewInputs: boolean}>`
  flex: 1;
  ${p =>
    p.hasMetricsNewInputs &&
    css`
      width: 100%;
    `}
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    min-width: 200px;
  }
`;
