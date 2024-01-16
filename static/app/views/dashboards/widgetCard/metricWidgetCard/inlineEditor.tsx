import {Fragment, memo, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonProps} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Tag from 'sentry/components/tag';
import {IconCheckmark, IconClose, IconLightning, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricMeta, MRI} from 'sentry/types';
import {
  getReadableMetricType,
  isAllowedOp,
  isCustomMetric,
  isMeasurement,
  isTransactionDuration,
  MetricDisplayType,
  MetricsQuery,
  MetricsQuerySubject,
  MetricWidgetQueryParams,
} from 'sentry/utils/metrics';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import {MetricSearchBar} from 'sentry/views/ddm/metricSearchBar';

import {formatMRI} from '../../../../utils/metrics/mri';

type InlineEditorProps = {
  displayType: MetricDisplayType;
  isEdit: boolean;
  metricsQuery: MetricsQuerySubject;
  onCancel: () => void;
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  onSubmit: () => void;
  projects: number[];
  powerUserMode?: boolean;
  size?: 'xs' | 'sm';
};

const isShownByDefault = (metric: MetricMeta) =>
  isMeasurement(metric) || isCustomMetric(metric) || isTransactionDuration(metric);

export const InlineEditor = memo(function InlineEditor({
  metricsQuery,
  projects,
  displayType,
  onChange,
  onCancel,
  onSubmit,
  isEdit,
  size = 'sm',
}: InlineEditorProps) {
  const {data: meta, isLoading: isMetaLoading} = useMetricsMeta(projects);

  const {data: tags = []} = useMetricsTags(metricsQuery.mri, projects);

  const displayedMetrics = useMemo(() => {
    const isSelected = (metric: MetricMeta) => metric.mri === metricsQuery.mri;
    return meta
      .filter(metric => isShownByDefault(metric) || isSelected(metric))
      .sort(metric => (isSelected(metric) ? -1 : 1));
  }, [meta, metricsQuery.mri]);

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

  const [loading, setIsLoading] = useState(false);
  useEffect(() => {
    if (loading && !isEdit) {
      setIsLoading(false);
    }
  }, [isEdit, loading]);

  return (
    <InlineEditorWrapper>
      <InlineEditorRowsWrapper>
        <InlineEditorRow>
          <WrapPageFilterBar>
            <CompactSelect
              size={size}
              searchable
              sizeLimit={100}
              triggerProps={{prefix: t('Metric'), size}}
              options={displayedMetrics.map(metric => ({
                label: formatMRI(metric.mri),
                // enable search by mri, name, unit (millisecond), type (c:), and readable type (counter)
                textValue: `${metric.mri}${getReadableMetricType(metric.type)}`,
                value: metric.mri,
                size,
                trailingItems: () => (
                  <Fragment>
                    <TagWithSize size={size} tooltipText={t('Type')}>
                      {getReadableMetricType(metric.type)}
                    </TagWithSize>
                    <TagWithSize size={size} tooltipText={t('Unit')}>
                      {metric.unit}
                    </TagWithSize>
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
              size={size}
              triggerProps={{prefix: t('Op'), size}}
              options={
                selectedMeta?.operations.filter(isAllowedOp).map(op => ({
                  label: op,
                  value: op,
                })) ?? []
              }
              disabled={!metricsQuery.mri}
              value={metricsQuery.op}
              onChange={option => {
                onChange({
                  op: option.value,
                });
              }}
            />
            <CompactSelect
              size={size}
              multiple
              triggerProps={{prefix: t('Group by'), size}}
              options={tags.map(tag => ({
                label: tag.key,
                value: tag.key,
                size,
                trailingItems: (
                  <Fragment>
                    {tag.key === 'release' && <IconReleases size={size} />}
                    {tag.key === 'transaction' && <IconLightning size={size} />}
                  </Fragment>
                ),
              }))}
              disabled={!metricsQuery.mri}
              value={metricsQuery.groupBy}
              onChange={options => {
                onChange({
                  groupBy: options.map(o => o.value),
                  focusedSeries: undefined,
                });
              }}
            />
            <CompactSelect
              size={size}
              triggerProps={{prefix: t('Display'), size}}
              value={displayType}
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
                onChange({displayType: value});
              }}
            />
          </WrapPageFilterBar>
        </InlineEditorRow>
        <InlineEditorRow>
          <MetricSearchBar
            projectIds={projects.map(id => id.toString())}
            mri={metricsQuery.mri}
            disabled={!metricsQuery.mri}
            onChange={query => {
              onChange({query});
            }}
            query={metricsQuery.query}
          />
        </InlineEditorRow>
      </InlineEditorRowsWrapper>
      <InlineEditorRowsWrapper>
        <SubmitButton
          size={size}
          loading={loading}
          onClick={() => {
            onSubmit();
            setIsLoading(true);
          }}
          aria-label="apply"
        />
        <Button
          size={size}
          onClick={onCancel}
          icon={<IconClose size="xs" />}
          aria-label="cancel"
        />
      </InlineEditorRowsWrapper>
    </InlineEditorWrapper>
  );
});

function SubmitButton({loading, ...buttonProps}: {loading: boolean} & ButtonProps) {
  if (loading) {
    return (
      <LoadingIndicatorButton {...buttonProps} priority="primary">
        <LoadingIndicator mini size={20} />
      </LoadingIndicatorButton>
    );
  }

  return (
    <Button {...buttonProps} priority="primary" icon={<IconCheckmark size="xs" />} />
  );
}

function getWidgetDisplayType(
  mri: MetricsQuery['mri'],
  op: MetricsQuery['op']
): MetricDisplayType {
  if (mri?.startsWith('c') || op === 'count') {
    return MetricDisplayType.BAR;
  }
  return MetricDisplayType.LINE;
}

function TagWithSize({size, children, ...props}: {size: 'sm' | 'xs'} & any) {
  if (size === 'sm') {
    return <Tag {...props}>{children}</Tag>;
  }
  return <TagXS {...props}>{children}</TagXS>;
}

const TagXS = styled(Tag)`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  height: ${space(2)};
  line-height: ${space(2)};

  span,
  div {
    height: ${space(2)};
    line-height: ${space(2)};
  }
`;

const LoadingIndicatorButton = styled(Button)`
  padding: 0;
  padding-left: ${space(0.75)};
  pointer-events: none;

  div.loading.mini {
    height: ${space(3)};
    width: 26px;
  }
`;

const InlineEditorWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: row;
  padding: ${space(1)};
  gap: ${space(1)};
  z-index: 1;
`;

const InlineEditorRowsWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const InlineEditorRow = styled('div')`
  padding-bottom: ${space(0.5)};
  background: ${p => p.theme.background};
`;

const WrapPageFilterBar = styled(PageFilterBar)`
  max-width: max-content;
  height: auto;
  flex-wrap: wrap;
`;
