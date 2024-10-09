import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta, ParsedMRI} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  ALLOWED_EXPLORE_VISUALIZE_FIELDS,
} from 'sentry/utils/fields';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {
  DEFAULT_EAP_FIELD,
  DEFAULT_EAP_METRICS_ALERT_FIELD,
  parseMRI,
} from 'sentry/utils/metrics/mri';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {SpanIndexedField} from 'sentry/views/insights/types';

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  project: Project;
}

// Use the same aggregates/operations available in the explore view
const OPERATIONS = [
  ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
    label: aggregate,
    value: aggregate,
  })),
];

function EAPField({aggregate, project, onChange}: Props) {
  const {data: meta, isLoading} = useVirtualizedMetricsMeta(
    {projects: [parseInt(project.id, 10)]},
    ['spans']
  );

  // TODO(edward): Fetch MRI's from the generic metrics dataset, and filter to just MRI's that appear in the Explore product (ie ALLOWED_EXPLORE_VISUALIZE_FIELDS).
  // I'm not aware of any way to fetch all eligible EAP fields at the moment, so we'll just cross MRI's with hardcoded Explore fields for now as a temporary workaround for the UI/Product.
  const metaArr = useMemo(() => {
    return meta
      .map(
        metric =>
          ({
            ...metric,
            ...parseMRI(metric.mri),
          }) as ParsedMRI & MetricMeta
      )
      .map(metric => {
        if (metric.mri === 'd:spans/exclusive_time@millisecond') {
          return {
            ...metric,
            name: SpanIndexedField.SPAN_SELF_TIME,
          };
        }
        return metric;
      })
      .filter(metric =>
        ALLOWED_EXPLORE_VISUALIZE_FIELDS.map(field => {
          return field.toString();
        }).includes(metric.name)
      );
  }, [meta]);

  // We parse out the aggregation and field from the aggregate string.
  // This only works for aggregates with <= 1 argument.
  const {
    name: aggregation,
    arguments: [field],
  } = parseFunction(aggregate) ?? {arguments: [undefined]};

  useEffect(() => {
    const selectedMriMeta = metaArr.find(metric => metric.name === field);
    if (field && !selectedMriMeta && !isLoading) {
      const newSelection = metaArr[0];
      if (newSelection) {
        onChange(`count(${newSelection.name})`, {});
      } else if (aggregate !== DEFAULT_EAP_METRICS_ALERT_FIELD) {
        onChange(DEFAULT_EAP_METRICS_ALERT_FIELD, {});
      }
    }
  }, [metaArr, onChange, isLoading, aggregate, aggregation, field]);

  const handleFieldChange = useCallback(
    option => {
      const selectedMeta = metaArr.find(metric => metric.name === option.value);
      if (!selectedMeta) {
        return;
      }
      onChange(`${aggregation}(${option.value})`, {});
    },
    [metaArr, onChange, aggregation]
  );

  // As SelectControl does not support an options size limit out of the box
  // we work around it by using the async variant of the control
  const getFieldOptions = useCallback(
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
        value: metric.name,
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
    label: field,
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
          if (field) {
            onChange(`${option.value}(${field})`, {});
          } else {
            onChange(`${option.value}(${DEFAULT_EAP_FIELD})`, {});
          }
        }}
      />
      <StyledSelectControl
        searchable
        isDisabled={isLoading}
        placeholder={t('Select a metric')}
        noOptionsMessage={() =>
          metaArr.length === 0 ? t('No metrics in this project') : t('No options')
        }
        async
        defaultOptions={getFieldOptions('')}
        loadOptions={searchText => Promise.resolve(getFieldOptions(searchText))}
        filterOption={() => true}
        value={selectedOption}
        onChange={handleFieldChange}
      />
    </Wrapper>
  );
}

export default EAPField;

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
