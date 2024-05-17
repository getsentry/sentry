import {Fragment, memo, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {ComboBox} from 'sentry/components/comboBox';
import type {ComboBoxOption} from 'sentry/components/comboBox/types';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconLightning, IconReleases, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta, MetricsOperation, MRI} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  isAllowedOp,
  isCustomMetric,
  isSpanMeasurement,
  isSpanSelfTime,
  isTransactionDuration,
  isTransactionMeasurement,
} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {MetricListItemDetails} from 'sentry/views/metrics/metricListItemDetails';
import {MetricSearchBar} from 'sentry/views/metrics/metricSearchBar';

type QueryBuilderProps = {
  index: number;
  metricsQuery: MetricsQuery;
  onChange: (data: Partial<MetricsQuery>) => void;
  projects: number[];
};

const isVisibleTransactionMetric = (metric: MetricMeta) =>
  isTransactionDuration(metric) || isTransactionMeasurement(metric);

const isVisibleSpanMetric = (metric: MetricMeta) =>
  isSpanSelfTime(metric) || isSpanMeasurement(metric);

const isShownByDefault = (metric: MetricMeta) =>
  isCustomMetric(metric) ||
  isVisibleTransactionMetric(metric) ||
  isVisibleSpanMetric(metric);

function getOpsForMRI(mri: MRI, meta: MetricMeta[]) {
  return meta.find(metric => metric.mri === mri)?.operations.filter(isAllowedOp) ?? [];
}

function useMriMode() {
  const [mriMode, setMriMode] = useState(false);
  const mriModeKeyPressed = useKeyPress('`', undefined, true);

  useEffect(() => {
    if (mriModeKeyPressed) {
      setMriMode(value => !value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mriModeKeyPressed]);

  return mriMode;
}

export const QueryBuilder = memo(function QueryBuilder({
  metricsQuery,
  projects: projectIds,
  onChange,
  index,
}: QueryBuilderProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {projects} = useProjects();

  const {
    data: meta,
    isLoading: isMetaLoading,
    isRefetching: isMetaRefetching,
    refetch: refetchMeta,
  } = useMetricsMeta(pageFilters.selection);
  const mriMode = useMriMode();

  const {data: tagsData = [], isLoading: tagsIsLoading} = useMetricsTags(
    metricsQuery.mri,
    {
      projects: projectIds,
    }
  );

  const selectedProjects = useMemo(
    () =>
      projects.filter(project =>
        projectIds[0] === -1
          ? true
          : projectIds.length === 0
            ? project.isMember
            : projectIds.includes(parseInt(project.id, 10))
      ),
    [projectIds, projects]
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

  const displayedMetrics = useMemo(() => {
    const isSelected = (metric: MetricMeta) => metric.mri === metricsQuery.mri;
    const result = meta
      .filter(metric => isShownByDefault(metric) || isSelected(metric))
      .sort(metric => (isSelected(metric) ? -1 : 1));

    // Add the selected metric to the top of the list if it's not already there
    if (result[0]?.mri !== metricsQuery.mri) {
      const parsedMri = parseMRI(metricsQuery.mri)!;
      return [
        {
          mri: metricsQuery.mri,
          type: parsedMri.type,
          unit: parsedMri.unit,
          operations: [],
          projectIds: [],
          blockingStatus: [],
        } satisfies MetricMeta,
        ...result,
      ];
    }

    return result;
  }, [meta, metricsQuery.mri]);

  const selectedMeta = useMemo(() => {
    return meta.find(metric => metric.mri === metricsQuery.mri);
  }, [meta, metricsQuery.mri]);

  const incrementQueryMetric = useIncrementQueryMetric({
    ...metricsQuery,
  });

  const handleMRIChange = useCallback(
    ({value}) => {
      const availableOps = getOpsForMRI(value, meta);
      const selectedOp = availableOps.includes(
        (metricsQuery.op ?? '') as MetricsOperation
      )
        ? metricsQuery.op
        : availableOps?.[0];

      const queryChanges = {
        mri: value,
        op: selectedOp,
        groupBy: undefined,
      };

      trackAnalytics('ddm.widget.metric', {organization});
      incrementQueryMetric('ddm.widget.metric', queryChanges);
      onChange(queryChanges);
    },
    [incrementQueryMetric, meta, metricsQuery.op, onChange, organization]
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

  const handleOpenMetricsMenu = useCallback(
    (isOpen: boolean) => {
      if (isOpen && !isMetaLoading && !isMetaRefetching) {
        refetchMeta();
      }
    },
    [isMetaLoading, isMetaRefetching, refetchMeta]
  );

  const mriOptions = useMemo(
    () =>
      displayedMetrics.map<ComboBoxOption<MRI>>(metric => ({
        label: mriMode
          ? metric.mri
          : middleEllipsis(formatMRI(metric.mri) ?? '', 46, /\.|-|_/),
        // enable search by mri, name, unit (millisecond), type (c:), and readable type (counter)
        textValue: `${metric.mri}${getReadableMetricType(metric.type)}`,
        value: metric.mri,
        details:
          metric.projectIds.length > 0 ? (
            <MetricListItemDetails
              metric={metric}
              selectedProjects={selectedProjects}
              onTagClick={(mri, tag) => {
                onChange({mri, groupBy: [tag]});
              }}
            />
          ) : null,
        showDetailsInOverlay: true,
        trailingItems:
          mriMode || parseMRI(metric.mri)?.useCase !== 'custom' ? undefined : (
            <CustomMetricInfoText>{t('Custom')}</CustomMetricInfoText>
          ),
      })),
    [displayedMetrics, mriMode, onChange, selectedProjects]
  );

  const projectIdStrings = useMemo(() => projectIds.map(String), [projectIds]);

  return (
    <QueryBuilderWrapper>
      <FlexBlock>
        <GuideAnchor target="metrics_selector" position="bottom" disabled={index !== 0}>
          <MetricComboBox
            aria-label={t('Metric')}
            placeholder={t('Select a metric')}
            loadingMessage={t('Loading metrics...')}
            sizeLimit={100}
            size="md"
            menuSize="sm"
            isLoading={isMetaLoading}
            onOpenChange={handleOpenMetricsMenu}
            options={mriOptions}
            value={metricsQuery.mri}
            onChange={handleMRIChange}
            growingInput
            menuWidth="450px"
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
                trailingItems: tag.trailingItems ?? (
                  <Fragment>
                    {tag.key === 'release' && <IconReleases size="xs" />}
                    {tag.key === 'transaction' && <IconLightning size="xs" />}
                  </Fragment>
                ),
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

const CustomMetricInfoText = styled('span')`
  color: ${p => p.theme.subText};
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

const MetricComboBox = styled(ComboBox)`
  min-width: 200px;
  max-width: min(500px, 100%);
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
