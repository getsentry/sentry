import {Fragment, memo, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import Tag from 'sentry/components/tag';
import {IconLightning, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta, MetricsOperation, MRI} from 'sentry/types';
import {
  getDefaultMetricDisplayType,
  isAllowedOp,
  isCustomMetric,
  isMeasurement,
  isSpanMetric,
  isTransactionDuration,
} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI} from 'sentry/utils/metrics/mri';
import type {
  MetricDisplayType,
  MetricsQuerySubject,
  MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import {useBreakpoints} from 'sentry/utils/metrics/useBreakpoints';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import useKeyPress from 'sentry/utils/useKeyPress';
import {useDDMContext} from 'sentry/views/ddm/context';
import {MetricSearchBar} from 'sentry/views/ddm/metricSearchBar';

type QueryBuilderProps = {
  displayType: MetricDisplayType;
  isEdit: boolean;
  metricsQuery: MetricsQuerySubject;
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  projects: number[];
  fixedWidth?: boolean;
  powerUserMode?: boolean;
};

const isShownByDefault = (metric: MetricMeta) =>
  isCustomMetric(metric) ||
  isTransactionDuration(metric) ||
  isMeasurement(metric) ||
  isSpanMetric(metric);

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
  const {metricsMeta: meta} = useDDMContext();
  const mriModeKeyPressed = useKeyPress('`', undefined, true);
  const [mriMode, setMriMode] = useState(powerUserMode); // power user mode that shows raw MRI instead of metrics names
  const breakpoints = useBreakpoints();

  useEffect(() => {
    if (mriModeKeyPressed && !powerUserMode) {
      setMriMode(!mriMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mriModeKeyPressed, powerUserMode]);

  const {data: tags = []} = useMetricsTags(metricsQuery.mri, {projects});

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

  const incrementQueryMetric = useIncrementQueryMetric({
    displayType,
    op: metricsQuery.op,
    groupBy: metricsQuery.groupBy,
    query: metricsQuery.query,
    mri: metricsQuery.mri,
  });

  const handleMRIChange = ({value}) => {
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

  const handleOpChange = ({value}) => {
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
        trailingItems: mriMode ? undefined : (
          <Fragment>
            <Tag tooltipText={t('Type')}>{getReadableMetricType(metric.type)}</Tag>
            <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
          </Fragment>
        ),
      })),
    [displayedMetrics, mriMode]
  );

  return (
    <QueryBuilderWrapper>
      <FlexBlock>
        <MetricSelect
          searchable
          sizeLimit={100}
          size="md"
          triggerLabel={middleEllipsis(
            formatMRI(metricsQuery.mri) ?? '',
            breakpoints.large ? (breakpoints.xlarge ? 70 : 45) : 30,
            /\.|-|_/
          )}
          placeholder={t('Select a metric')}
          options={mriOptions}
          value={metricsQuery.mri}
          onChange={handleMRIChange}
        />
        <FlexBlock>
          <OpSelect
            size="md"
            triggerProps={{prefix: t('Op')}}
            options={
              selectedMeta?.operations.filter(isAllowedOp).map(op => ({
                label: op,
                value: op,
              })) ?? []
            }
            disabled={!metricsQuery.mri}
            value={metricsQuery.op}
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

const MetricSelect = styled(CompactSelect)`
  min-width: 200px;
  & > button {
    width: 100%;
  }
`;

const OpSelect = styled(CompactSelect)`
  width: 120px;
  & > button {
    width: 100%;
  }
`;

const SearchBarWrapper = styled('div')`
  flex: 1;
  min-width: 200px;
`;
