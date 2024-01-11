import {Fragment, memo, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import Tag from 'sentry/components/tag';
import {IconLightning, IconReleases, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricMeta, MetricsOperation, MRI} from 'sentry/types';
import {
  getDefaultMetricDisplayType,
  getReadableMetricType,
  isAllowedOp,
  isCustomMetric,
  isMeasurement,
  isTransactionDuration,
  MetricDisplayType,
  MetricsQuerySubject,
  MetricWidgetQueryParams,
} from 'sentry/utils/metrics';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import useKeyPress from 'sentry/utils/useKeyPress';
import useRouter from 'sentry/utils/useRouter';
import {MetricSearchBar} from 'sentry/views/ddm/metricSearchBar';

type QueryBuilderProps = {
  displayType: MetricDisplayType;
  isEdit: boolean;
  metricsQuery: MetricsQuerySubject;
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  projects: number[];
  powerUserMode?: boolean;
};

const isShownByDefault = (metric: MetricMeta) =>
  isMeasurement(metric) || isCustomMetric(metric) || isTransactionDuration(metric);

function getOpsForMRI(mri: MRI, meta: MetricMeta[]) {
  return meta.find(metric => metric.mri === mri)?.operations.filter(isAllowedOp) ?? [];
}

export const QueryBuilder = memo(function QueryBuilder({
  metricsQuery,
  projects,
  displayType,
  powerUserMode,
  onChange,
}: QueryBuilderProps) {
  const {data: meta, isLoading: isMetaLoading} = useMetricsMeta(projects);
  const router = useRouter();
  const mriModeKeyPressed = useKeyPress('`', undefined, true);
  const [mriMode, setMriMode] = useState(powerUserMode); // power user mode that shows raw MRI instead of metrics names

  useEffect(() => {
    if (mriModeKeyPressed && !powerUserMode) {
      setMriMode(!mriMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mriModeKeyPressed, powerUserMode]);

  const {data: tags = []} = useMetricsTags(metricsQuery.mri, projects);

  const displayedMetrics = useMemo(() => {
    if (mriMode) {
      return meta;
    }

    const isSelected = (metric: MetricMeta) => metric.mri === metricsQuery.mri;
    return meta
      .filter(metric => isShownByDefault(metric) || isSelected(metric))
      .sort(metric => (isSelected(metric) ? -1 : 1));
  }, [meta, metricsQuery.mri, mriMode]);

  const selectedMeta = useMemo(() => {
    return meta.find(metric => metric.mri === metricsQuery.mri);
  }, [meta, metricsQuery.mri]);

  // Reset the query data if the selected metric is no longer available
  useEffect(() => {
    if (
      metricsQuery.mri &&
      !isMetaLoading &&
      !displayedMetrics.find(metric => metric.mri === metricsQuery.mri)
    ) {
      onChange({mri: '' as MRI, op: '', groupBy: []});
    }
  }, [isMetaLoading, displayedMetrics, metricsQuery.mri, onChange]);

  const incrementQueryMetric = useIncrementQueryMetric({
    displayType,
    op: metricsQuery.op,
    groupBy: metricsQuery.groupBy,
    query: metricsQuery.query,
    mri: metricsQuery.mri,
  });

  const handleMRIChange = ({value}: SelectOption<MRI>) => {
    const availableOps = getOpsForMRI(value, meta);
    const selectedOp = availableOps.includes((metricsQuery.op ?? '') as MetricsOperation)
      ? metricsQuery.op
      : availableOps?.[0];

    const queryChanges = {
      mri: value,
      op: selectedOp,
      groupBy: undefined,
      displayType: getDefaultMetricDisplayType(value, selectedOp),
    };

    incrementQueryMetric('ddm.widget.metric', queryChanges);
    onChange({
      ...queryChanges,
      focusedSeries: undefined,
    });
  };

  const handleOpChange = ({value}: SelectOption<MetricsOperation>) => {
    incrementQueryMetric('ddm.widget.operation', {op: value});
    onChange({
      op: value,
    });
  };

  const handleGroupByChange = (options: SelectOption<string>[]) => {
    incrementQueryMetric('ddm.widget.group', {
      groupBy: options.map(o => o.value),
    });
    onChange({
      groupBy: options.map(o => o.value),
      focusedSeries: undefined,
    });
  };

  const mriOptions = useMemo(
    () =>
      displayedMetrics.map<SelectOption<MRI>>(metric => ({
        label: mriMode ? metric.mri : formatMRI(metric.mri),
        // enable search by mri, name, unit (millisecond), type (c:), and readable type (counter)
        textValue: `${metric.mri}${getReadableMetricType(metric.type)}`,
        value: metric.mri,
        trailingItems: mriMode
          ? undefined
          : ({isFocused}) => (
              <Fragment>
                {isFocused && isCustomMetric({mri: metric.mri}) && (
                  <Button
                    borderless
                    size="zero"
                    icon={<IconSettings />}
                    aria-label={t('Metric Settings')}
                    onPointerDown={() => {
                      // not using onClick to beat the dropdown listener
                      navigateTo(
                        `/settings/projects/:projectId/metrics/${encodeURIComponent(
                          metric.mri
                        )}`,
                        router
                      );
                    }}
                  />
                )}

                <Tag tooltipText={t('Type')}>{getReadableMetricType(metric.type)}</Tag>
                <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
              </Fragment>
            ),
      })),
    [displayedMetrics, mriMode, router]
  );

  return (
    <QueryBuilderWrapper>
      <FlexBlock>
        <CompactSelect
          searchable
          sizeLimit={100}
          size="md"
          triggerLabel={middleEllipsis(formatMRI(metricsQuery.mri) ?? '', 35, /\.|-|_/)}
          options={mriOptions}
          value={metricsQuery.mri}
          onChange={handleMRIChange}
        />
        <FlexBlock>
          <CompactSelect
            size="md"
            triggerProps={{prefix: t('Op')}}
            options={
              selectedMeta?.operations.filter(isAllowedOp).map(op => ({
                label: op,
                value: op,
              })) ?? []
            }
            disabled={!metricsQuery.mri}
            value={metricsQuery.op as MetricsOperation}
            onChange={handleOpChange}
          />
          <CompactSelect
            multiple
            size="md"
            triggerProps={{prefix: t('Group by')}}
            options={tags.map(tag => ({
              label: tag.key,
              value: tag.key,
              trailingItems: (
                <Fragment>
                  {tag.key === 'release' && <IconReleases size="xs" />}
                  {tag.key === 'transaction' && <IconLightning size="xs" />}
                </Fragment>
              ),
            }))}
            disabled={!metricsQuery.mri}
            value={metricsQuery.groupBy}
            onChange={handleGroupByChange}
          />
        </FlexBlock>
      </FlexBlock>
      <SearchBarWrapper>
        <MetricSearchBar
          // TODO(aknaus): clean up projectId type in ddm
          projectIds={projects.map(id => id.toString())}
          mri={metricsQuery.mri}
          disabled={!metricsQuery.mri}
          onChange={query => {
            incrementQueryMetric('ddm.widget.filter', {query});
            onChange({query});
          }}
          query={metricsQuery.query}
        />
      </SearchBarWrapper>
    </QueryBuilderWrapper>
  );
});

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

const SearchBarWrapper = styled('div')`
  flex: 1;
  min-width: 300px;
`;
