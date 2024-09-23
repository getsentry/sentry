import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricAggregation, MetricMeta, ParsedMRI} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {parseFunction} from 'sentry/utils/discover/fields';
import {getDefaultAggregation} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {
  DEFAULT_INSIGHTS_METRICS_ALERT_FIELD,
  DEFAULT_INSIGHTS_MRI,
  formatMRI,
  isMRI,
  MRIToField,
  parseMRI,
} from 'sentry/utils/metrics/mri';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {
  INSIGHTS_METRICS,
  INSIGHTS_METRICS_OPERATIONS,
  INSIGHTS_METRICS_OPERATIONS_WITH_CUSTOM_ARGS,
  INSIGHTS_METRICS_OPERATIONS_WITHOUT_ARGS,
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
  ...INSIGHTS_METRICS_OPERATIONS.map(({label, value}) => ({label, value})),
];

function aggregateRequiresArgs(aggregation?: string) {
  return !INSIGHTS_METRICS_OPERATIONS_WITHOUT_ARGS.some(
    ({value}) => value === aggregation
  );
}

function aggregateHasCustomArgs(aggregation?: string) {
  return INSIGHTS_METRICS_OPERATIONS_WITH_CUSTOM_ARGS.some(
    ({value}) => value === aggregation
  );
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

  // We parse out the aggregation and field from the aggregate string.
  // This only works for aggregates with <= 1 argument.
  const {
    name: aggregation,
    arguments: [field],
  } = parseFunction(aggregate) ?? {arguments: [undefined]};

  const selectedMriMeta = useMemo(() => {
    return meta.find(metric => metric.mri === field);
  }, [meta, field]);

  useEffect(() => {
    if (!aggregateRequiresArgs(aggregation)) {
      return;
    }
    if (aggregation && aggregateHasCustomArgs(aggregation)) {
      const options = INSIGHTS_METRICS_OPERATIONS_WITH_CUSTOM_ARGS.find(
        ({value}) => value === aggregation
      )?.options;
      if (options && !options.some(({value}) => value === field)) {
        onChange(`${aggregation}(${options?.[0].value})`, {});
      }
      return;
    }
    if (field && !selectedMriMeta && !isLoading) {
      const newSelection = metaArr[0];
      if (newSelection) {
        onChange(MRIToField(newSelection.mri, 'avg'), {});
      } else if (aggregate !== DEFAULT_INSIGHTS_METRICS_ALERT_FIELD) {
        onChange(DEFAULT_INSIGHTS_METRICS_ALERT_FIELD, {});
      }
    }
  }, [metaArr, onChange, isLoading, aggregate, selectedMriMeta, aggregation, field]);

  const handleMriChange = useCallback(
    option => {
      const selectedMeta = meta.find(metric => metric.mri === option.value);
      if (!selectedMeta) {
        return;
      }
      const newType = parseMRI(option.value)?.type;
      // If the type is the same, we can keep the current aggregate
      if (newType === selectedMeta.type && aggregation) {
        onChange(MRIToField(option.value, aggregation as MetricAggregation), {});
      } else {
        onChange(MRIToField(option.value, getDefaultAggregation(option.value)), {});
      }
    },
    [meta, onChange, aggregation]
  );

  const handleOptionChange = useCallback(
    option => {
      if (!option || !aggregation) {
        return;
      }
      onChange(`${aggregation}(${option.value})`, {});
    },
    [onChange, aggregation]
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
  const selectedOption = field && {
    label: isMRI(field) ? formatMRI(field) : field,
    value: field,
  };

  return (
    <Wrapper>
      <StyledSelectControl
        searchable
        isDisabled={isLoading}
        placeholder={t('Select an operation')}
        options={OPERATIONS}
        value={aggregation}
        onChange={option => {
          if (!aggregateRequiresArgs(option.value)) {
            onChange(`${option.value}()`, {});
          } else if (aggregateHasCustomArgs(option.value)) {
            const options = INSIGHTS_METRICS_OPERATIONS_WITH_CUSTOM_ARGS.find(
              ({value}) => value === option.value
            )?.options;
            onChange(`${option.value}(${options?.[0].value})`, {});
          } else if (field && isMRI(field)) {
            onChange(MRIToField(field, option.value), {});
          } else {
            onChange(MRIToField(DEFAULT_INSIGHTS_MRI, option.value), {});
          }
        }}
      />
      {aggregateRequiresArgs(aggregation) &&
        (aggregateHasCustomArgs(aggregation) ? (
          <StyledSelectControl
            searchable
            placeholder={t('Select an option')}
            options={
              INSIGHTS_METRICS_OPERATIONS_WITH_CUSTOM_ARGS.find(
                ({value}) => value === aggregation
              )?.options
            }
            value={selectedOption}
            onChange={handleOptionChange}
          />
        ) : (
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
            value={selectedOption}
            onChange={handleMriChange}
          />
        ))}
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
