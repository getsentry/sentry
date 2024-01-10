import {Fragment, memo, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {CompactSelect} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import {IconLightning, IconReleases, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricMeta, MRI} from 'sentry/types';
import {
  defaultMetricDisplayType,
  getReadableMetricType,
  isAllowedOp,
  isCustomMetric,
  isMeasurement,
  isTransactionDuration,
  MetricDisplayType,
  MetricsQuery,
  MetricsQuerySubject,
  MetricWidgetQueryParams,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';
import {formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useKeyPress from 'sentry/utils/useKeyPress';
import useRouter from 'sentry/utils/useRouter';
import {MetricSearchBar} from 'sentry/views/ddm/metricSearchBar';

type QueryBuilderProps = {
  displayType: MetricDisplayType;
  isEdit: boolean;
  // TODO(ddm): move display type out of the query builder
  metricsQuery: MetricsQuerySubject;
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  projects: number[];
  powerUserMode?: boolean;
};

const isShownByDefault = (metric: MetricMeta) =>
  isMeasurement(metric) || isCustomMetric(metric) || isTransactionDuration(metric);

function stopPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

export const QueryBuilder = memo(function QueryBuilder({
  metricsQuery,
  projects,
  displayType,
  powerUserMode,
  onChange,
  isEdit,
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

  const stringifiedMetricWidget = stringifyMetricWidget(metricsQuery);

  const readableType = getReadableMetricType(parseMRI(metricsQuery.mri)?.type);

  if (!isEdit) {
    return (
      <QueryBuilderWrapper>
        <WidgetTitle>
          <TextOverflow>{metricsQuery.title || stringifiedMetricWidget}</TextOverflow>
        </WidgetTitle>
      </QueryBuilderWrapper>
    );
  }

  return (
    <QueryBuilderWrapper>
      <QueryBuilderRow>
        <WrapPageFilterBar>
          <CompactSelect
            searchable
            sizeLimit={100}
            triggerProps={{prefix: t('Metric'), size: 'sm'}}
            options={displayedMetrics.map(metric => ({
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

                      <Tag tooltipText={t('Type')}>
                        {getReadableMetricType(metric.type)}
                      </Tag>
                      <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
                    </Fragment>
                  ),
            }))}
            value={metricsQuery.mri}
            onChange={option => {
              const availableOps =
                meta
                  .find(metric => metric.mri === option.value)
                  ?.operations.filter(isAllowedOp) ?? [];

              // @ts-expect-error .op is an operation
              const selectedOp = availableOps.includes(metricsQuery.op ?? '')
                ? metricsQuery.op
                : availableOps?.[0];
              Sentry.metrics.increment('ddm.widget.metric', 1, {
                tags: {
                  display: displayType ?? defaultMetricDisplayType,
                  type: readableType,
                  operation: selectedOp,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                mri: option.value,
                op: selectedOp,
                groupBy: undefined,
                focusedSeries: undefined,
                displayType: getWidgetDisplayType(option.value, selectedOp),
              });
            }}
          />
          <CompactSelect
            triggerProps={{prefix: t('Op'), size: 'sm'}}
            options={
              selectedMeta?.operations.filter(isAllowedOp).map(op => ({
                label: op,
                value: op,
              })) ?? []
            }
            disabled={!metricsQuery.mri}
            value={metricsQuery.op}
            onChange={option => {
              Sentry.metrics.increment('ddm.widget.operation', 1, {
                tags: {
                  display: displayType ?? defaultMetricDisplayType,
                  type: readableType,
                  operation: option.value,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                op: option.value,
              });
            }}
          />
          <CompactSelect
            multiple
            triggerProps={{prefix: t('Group by'), size: 'sm'}}
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
            onChange={options => {
              Sentry.metrics.increment('ddm.widget.group', 1, {
                tags: {
                  display: displayType ?? defaultMetricDisplayType,
                  type: readableType,
                  operation: metricsQuery.op,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                groupBy: options.map(o => o.value),
                focusedSeries: undefined,
              });
            }}
          />
          <CompactSelect
            triggerProps={{prefix: t('Display'), size: 'sm'}}
            value={displayType ?? defaultMetricDisplayType}
            options={[
              {
                value: MetricDisplayType.LINE,
                label: t('Line'),
              },
              {
                value: MetricDisplayType.AREA,
                label: t('Area'),
              },
              {
                value: MetricDisplayType.BAR,
                label: t('Bar'),
              },
            ]}
            onChange={({value}) => {
              Sentry.metrics.increment('ddm.widget.display', 1, {
                tags: {
                  display: value,
                  type: readableType,
                  operation: metricsQuery.op,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({displayType: value});
            }}
          />
        </WrapPageFilterBar>
      </QueryBuilderRow>
      {/* Stop propagation so widget does not get selected immediately */}
      <QueryBuilderRow onClick={stopPropagation}>
        <MetricSearchBar
          // TODO(aknaus): clean up projectId type in ddm
          projectIds={projects.map(id => id.toString())}
          mri={metricsQuery.mri}
          disabled={!metricsQuery.mri}
          onChange={query => {
            Sentry.metrics.increment('ddm.widget.filter', 1, {
              tags: {
                display: displayType ?? defaultMetricDisplayType,
                type: readableType,
                operation: metricsQuery.op,
                isGrouped: !!metricsQuery.groupBy?.length,
                isFiltered: !!query,
              },
            });
            onChange({query});
          }}
          query={metricsQuery.query}
        />
      </QueryBuilderRow>
    </QueryBuilderWrapper>
  );
});

function getWidgetDisplayType(
  mri: MetricsQuery['mri'],
  op: MetricsQuery['op']
): MetricDisplayType {
  if (mri?.startsWith('c') || op === 'count') {
    return MetricDisplayType.BAR;
  }
  return MetricDisplayType.LINE;
}

const QueryBuilderWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
`;

const QueryBuilderRow = styled('div')`
  padding: ${space(1)};
  padding-bottom: 0;
`;

const WrapPageFilterBar = styled(PageFilterBar)`
  max-width: max-content;
  height: auto;
  flex-wrap: wrap;
`;

const WidgetTitle = styled(HeaderTitle)`
  padding-left: ${space(2)};
  padding-top: ${space(1.5)};
  padding-right: ${space(1)};
`;
