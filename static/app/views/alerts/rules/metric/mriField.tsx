import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricAggregation, MetricMeta, ParsedMRI} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {getDefaultAggregation, isAllowedAggregation} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {
  DEFAULT_METRIC_ALERT_FIELD,
  formatMRI,
  MRIToField,
  parseField,
  parseMRI,
} from 'sentry/utils/metrics/mri';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  project: Project;
}

function filterAndSortAggregations(aggregations: MetricAggregation[]) {
  return aggregations.filter(isAllowedAggregation).sort((a, b) => a.localeCompare(b));
}

function MriField({aggregate, project, onChange}: Props) {
  const {data: meta, isLoading} = useVirtualizedMetricsMeta(
    {projects: [parseInt(project.id, 10)]},
    ['custom']
  );

  const metaArr = useMemo(() => {
    return meta.map(
      metric =>
        ({
          ...metric,
          ...parseMRI(metric.mri),
        }) as ParsedMRI & MetricMeta
    );
  }, [meta]);

  const selectedValues = parseField(aggregate);

  const selectedMriMeta = useMemo(() => {
    return meta.find(metric => metric.mri === selectedValues?.mri);
  }, [meta, selectedValues?.mri]);

  useEffect(() => {
    // Auto-select the first mri if none of the available ones is selected
    if (!selectedMriMeta && !isLoading) {
      const newSelection = metaArr[0];
      if (newSelection) {
        onChange(
          MRIToField(
            newSelection.mri,
            filterAndSortAggregations(newSelection.operations)[0]!
          ),
          {}
        );
      } else if (aggregate !== DEFAULT_METRIC_ALERT_FIELD) {
        onChange(DEFAULT_METRIC_ALERT_FIELD, {});
      }
    }
  }, [metaArr, onChange, selectedMriMeta, isLoading, aggregate]);

  const handleMriChange = useCallback(
    (option: any) => {
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

  const operationOptions = useMemo(
    () =>
      filterAndSortAggregations(selectedMriMeta?.operations ?? []).map(op => ({
        label: op,
        value: op,
      })),
    [selectedMriMeta]
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
  const selectedMriOption = selectedMriMeta && {
    label: formatMRI(selectedMriMeta.mri),
    value: selectedMriMeta.mri,
  };

  return (
    <Wrapper>
      <StyledSelectControl
        searchable
        isDisabled={isLoading}
        placeholder={t('Select a metric')}
        noOptionsMessage={() =>
          metaArr.length === 0 ? t('No metrics in this project') : t('No options')
        }
        async
        defaultOptions={getMriOptions('')}
        loadOptions={(searchText: any) => Promise.resolve(getMriOptions(searchText))}
        filterOption={() => true}
        value={selectedMriOption}
        onChange={handleMriChange}
      />
      <StyledSelectControl
        searchable
        isDisabled={isLoading || !selectedMriMeta}
        placeholder={t('Select an operation')}
        options={operationOptions}
        value={selectedValues?.aggregation}
        onChange={(option: any) => {
          if (selectedMriOption?.value) {
            onChange(MRIToField(selectedMriOption.value, option.value), {});
          }
        }}
      />
    </Wrapper>
  );
}

export default MriField;

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr 1fr;
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
