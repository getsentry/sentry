import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta, ParsedMRI} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {getDefaultAggregation} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {
  DEFAULT_INSIGHTS_METRICS_ALERT_FIELD,
  DEFAULT_INSIGHTS_MRI,
  formatMRI,
  MRIToField,
  parseField,
  parseMRI,
} from 'sentry/utils/metrics/mri';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {
  INSIGHTS_METRICS,
  INSIGHTS_METRICS_OPERATIONS,
} from 'sentry/views/alerts/rules/metric/utils/isInsightsMetricAlert';

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  project: Project;
}

// We actually only store a few aggregations for Insights metrics.
// The `metrics/meta/` endpoint doesn't know this, so hardcode supported aggregations for now.
const OPERATIONS = [
  {
    label: 'avg',
    value: 'avg',
  },
  {
    label: 'sum',
    value: 'sum',
  },
  {
    label: 'min',
    value: 'min',
  },
  {
    label: 'max',
    value: 'max',
  },
  ...INSIGHTS_METRICS_OPERATIONS,
];

function aggregateRequiresArgs(aggregation?: string) {
  return !['spm', 'cache_miss_rate'].includes(aggregation ?? '');
}

function InsightsMetricField({aggregate, project, onChange}: Props) {
  const {data: meta, isLoading} = useVirtualizedMetricsMeta(
    {projects: [parseInt(project.id, 10)]},
    ['spans']
  );

  const metaArr = useMemo(() => {
    return meta
      .map(
        metric =>
          ({
            ...metric,
            ...parseMRI(metric.mri),
          }) as ParsedMRI & MetricMeta
      )
      .filter(metric => INSIGHTS_METRICS.includes(metric.mri));
  }, [meta]);

  const selectedValues = parseField(aggregate);

  const selectedMriMeta = useMemo(() => {
    return meta.find(metric => metric.mri === selectedValues?.mri);
  }, [meta, selectedValues?.mri]);

  useEffect(() => {
    if (!aggregateRequiresArgs(selectedValues?.aggregation)) {
      return;
    }
    if (selectedValues?.mri && !selectedMriMeta && !isLoading) {
      const newSelection = metaArr[0];
      if (newSelection) {
        onChange(MRIToField(newSelection.mri, 'avg'), {});
      } else if (aggregate !== DEFAULT_INSIGHTS_METRICS_ALERT_FIELD) {
        onChange(DEFAULT_INSIGHTS_METRICS_ALERT_FIELD, {});
      }
    }
  }, [
    metaArr,
    onChange,
    isLoading,
    aggregate,
    selectedValues?.mri,
    selectedMriMeta,
    selectedValues?.aggregation,
  ]);

  const handleMriChange = useCallback(
    option => {
      const selectedMeta = meta.find(metric => metric.mri === option.value);
      if (!selectedMeta) {
        return;
      }
      const newType = parseMRI(option.value)?.type;
      // If the type is the same, we can keep the current aggregate
      if (newType === selectedMeta.type && selectedValues?.aggregation) {
        onChange(MRIToField(option.value, selectedValues?.aggregation), {});
      } else {
        onChange(MRIToField(option.value, getDefaultAggregation(option.value)), {});
      }
    },
    [meta, onChange, selectedValues?.aggregation]
  );

  // As SelectControl does not support an options size limit out of the box
  // we work around it by using the async variant of the control
  const getMriOptions = useCallback(
    (searchText: string) => {
      const filteredMeta = metaArr.filter(
        ({name}) =>
          searchText === '' || name.toLowerCase().includes(searchText.toLowerCase())
      );

      const options = filteredMeta.splice(0, 100).map<{
        label: React.ReactNode;
        value: string;
        disabled?: boolean;
        trailingItems?: React.ReactNode;
      }>(metric => ({
        label: middleEllipsis(metric.name, 50, /\.|-|_/),
        value: metric.mri,
        trailingItems: (
          <Fragment>
            <Tag tooltipText={t('Type')}>{getReadableMetricType(metric.type)}</Tag>
            <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
          </Fragment>
        ),
      }));

      if (filteredMeta.length > options.length) {
        options.push({
          label: (
            <SizeLimitMessage>{t('Use search to find more options…')}</SizeLimitMessage>
          ),
          value: '',
          disabled: true,
        });
      }
      return options;
    },
    [metaArr]
  );

  // When using the async variant of SelectControl, we need to pass in an option object instead of just the value
  const selectedMriOption = selectedValues?.mri && {
    label: formatMRI(selectedValues.mri),
    value: selectedValues.mri,
  };

  return (
    <Wrapper>
      <StyledSelectControl
        searchable
        isDisabled={isLoading}
        placeholder={t('Select an operation')}
        options={OPERATIONS}
        value={selectedValues?.aggregation}
        onChange={option => {
          if (!aggregateRequiresArgs(option.value)) {
            onChange(`${option.value}()`, {});
          } else if (selectedValues?.mri) {
            onChange(MRIToField(selectedValues.mri, option.value), {});
          } else {
            onChange(MRIToField(DEFAULT_INSIGHTS_MRI, option.value), {});
          }
        }}
      />
      {aggregateRequiresArgs(selectedValues?.aggregation) && (
        <StyledSelectControl
          searchable
          isDisabled={isLoading}
          placeholder={t('Select a metric')}
          noOptionsMessage={() =>
            metaArr.length === 0 ? t('No metrics in this project') : t('No options')
          }
          async
          defaultOptions={getMriOptions('')}
          loadOptions={searchText => Promise.resolve(getMriOptions(searchText))}
          filterOption={() => true}
          value={selectedMriOption}
          onChange={handleMriChange}
        />
      )}
    </Wrapper>
  );
}

export default InsightsMetricField;

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledSelectControl = styled(SelectControl)`
  width: 200px;
`;

const SizeLimitMessage = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: block;
  width: 100%;
  text-align: center;
`;
