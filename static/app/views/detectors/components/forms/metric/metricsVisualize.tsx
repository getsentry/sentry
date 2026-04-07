import type {ReactNode} from 'react';
import {Fragment, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Tag} from '@sentry/scraps/badge';
import {
  CompactSelect,
  type SelectKey,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {FormContext} from 'sentry/components/forms/formContext';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {usePrevious} from 'sentry/utils/usePrevious';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import {useHasMetricUnitsUI} from 'sentry/views/explore/metrics/hooks/useHasMetricUnitsUI';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import {NONE_UNIT} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';

interface MetricSelectOption extends SelectOption<string> {
  metricName: string;
  metricType: TraceMetricTypeValue;
  trailingItems: ReactNode;
  metricUnit?: string;
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}||${metric.unit ?? '-'}`;
}

/**
 * Trace metrics-specific visualize component for the detector form.
 * Shows a metric name picker and operation picker, building the aggregate
 * string in the format expected by the backend (e.g. "sum(value,metric_name,counter,-)")
 */
export function MetricsVisualize() {
  const formContext = useContext(FormContext);
  const hasMetricUnitsUI = useHasMetricUnitsUI();
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);

  const {aggregation, traceMetric} = parseMetricAggregate(aggregateFunction ?? '');

  const [search, setSearch] = useState('');
  const {
    data: metricOptionsData,
    isFetching,
    isMetricOptionsEmpty,
  } = useMetricOptions({
    search,
    projectIds: projectId ? [parseInt(projectId, 10)] : undefined,
    environments: environment ? [environment] : undefined,
  });

  const metricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );
  const optionFromTraceMetric: MetricSelectOption = useMemo(
    () => ({
      label: traceMetric.name || t('Select a metric'),
      value: metricSelectValue,
      metricType: traceMetric.type as TraceMetricTypeValue,
      metricName: traceMetric.name,
      metricUnit: hasMetricUnitsUI ? (traceMetric.unit ?? NONE_UNIT) : undefined,
      trailingItems: (
        <Fragment>
          <MetricTypeBadge metricType={traceMetric.type as TraceMetricTypeValue} />
          {hasMetricUnitsUI &&
            traceMetric.unit &&
            traceMetric.unit !== '-' &&
            traceMetric.unit !== NONE_UNIT && (
              <Tag variant="promotion">{traceMetric.unit}</Tag>
            )}
        </Fragment>
      ),
    }),
    [
      metricSelectValue,
      traceMetric.name,
      traceMetric.type,
      traceMetric.unit,
      hasMetricUnitsUI,
    ]
  );

  const metricOptions = useMemo((): MetricSelectOption[] => {
    const shouldIncludeOptionFromTraceMetric =
      traceMetric.name &&
      !metricOptionsData?.data?.some(
        option => option[TraceMetricKnownFieldKey.METRIC_NAME] === traceMetric.name
      );
    return [
      ...(shouldIncludeOptionFromTraceMetric ? [optionFromTraceMetric] : []),
      ...(metricOptionsData?.data?.map(option => ({
        label: option[TraceMetricKnownFieldKey.METRIC_NAME],
        value: makeMetricSelectValue({
          name: option[TraceMetricKnownFieldKey.METRIC_NAME],
          type: option[TraceMetricKnownFieldKey.METRIC_TYPE] as TraceMetricTypeValue,
          unit: hasMetricUnitsUI
            ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
            : undefined,
        }),
        metricType: option[TraceMetricKnownFieldKey.METRIC_TYPE],
        metricName: option[TraceMetricKnownFieldKey.METRIC_NAME],
        metricUnit: hasMetricUnitsUI
          ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
          : undefined,
        trailingItems: (
          <Fragment>
            <MetricTypeBadge metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]} />
            {hasMetricUnitsUI &&
              option[TraceMetricKnownFieldKey.METRIC_UNIT] &&
              option[TraceMetricKnownFieldKey.METRIC_UNIT] !== NONE_UNIT && (
                <Tag variant="promotion">
                  {option[TraceMetricKnownFieldKey.METRIC_UNIT]}
                </Tag>
              )}
          </Fragment>
        ),
      })) ?? []),
    ];
  }, [metricOptionsData, optionFromTraceMetric, traceMetric.name, hasMetricUnitsUI]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce((newSearch: string) => {
      setSearch(newSearch);
    }, DEFAULT_DEBOUNCE_DURATION),
    [setSearch]
  );

  useEffect(() => {
    return () => debouncedSetSearch.cancel();
  }, [debouncedSetSearch]);

  const operationOptions = useMemo(() => {
    const metricType = traceMetric.type?.toLowerCase() ?? '';
    return OPTIONS_BY_TYPE[metricType] ?? OPTIONS_BY_TYPE.distribution ?? [];
  }, [traceMetric.type]);

  const updateFormAggregate = useCallback(
    (newAggregate: string) => {
      formContext.form?.setValue(
        METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
        newAggregate
      );
    },
    [formContext.form]
  );

  const handleOperationChange = useCallback(
    (option: SelectOption<SelectKey>) => {
      updateFormAggregate(
        makeMetricsAggregate({aggregate: String(option.value), traceMetric})
      );
    },
    [updateFormAggregate, traceMetric]
  );

  const handleMetricChange = useCallback(
    (option: MetricSelectOption) => {
      const newMetric: TraceMetric = {
        name: option.metricName,
        type: option.metricType,
        unit: hasMetricUnitsUI ? (option.metricUnit ?? NONE_UNIT) : undefined,
      };
      const newMetricType = option.metricType?.toLowerCase() ?? '';
      const validOperations = OPTIONS_BY_TYPE[newMetricType] ?? [];
      const newAggregation = validOperations[0]?.value ?? 'avg';

      updateFormAggregate(
        makeMetricsAggregate({aggregate: newAggregation, traceMetric: newMetric})
      );
    },
    [updateFormAggregate, hasMetricUnitsUI]
  );

  // Auto-select the first metric when options load and none is selected
  useEffect(() => {
    if (metricOptions.length && metricOptions[0] && !traceMetric.name) {
      const firstMetric = metricOptions[0];
      const metricType = firstMetric.metricType?.toLowerCase() ?? '';
      const validOperations = OPTIONS_BY_TYPE[metricType] ?? [];
      const firstOperation = validOperations[0]?.value ?? 'avg';

      updateFormAggregate(
        makeMetricsAggregate({
          aggregate: firstOperation,
          traceMetric: {
            name: firstMetric.metricName,
            type: firstMetric.metricType,
            unit: hasMetricUnitsUI ? (firstMetric.metricUnit ?? NONE_UNIT) : undefined,
          },
        })
      );
    }
  }, [metricOptions, updateFormAggregate, traceMetric.name, hasMetricUnitsUI]);

  const traceMetricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );
  const previousOptions = usePrevious(metricOptions ?? []);
  const hasNoMetrics = isMetricOptionsEmpty && !search;

  return (
    <Flex direction="column" gap="md">
      <Flex gap="md" align="end">
        <Stack flex="1" gap="xs" maxWidth="425px">
          <div>
            <Tooltip
              title={t('Select the metric to monitor for this detector.')}
              showUnderline
            >
              <SectionLabel>{t('Metric')}</SectionLabel>
            </Tooltip>
          </div>
          <Tooltip
            title={t('No metrics found for this project')}
            disabled={!hasNoMetrics}
          >
            <div>
              <StyledSelect
                search={{onChange: debouncedSetSearch, filter: false}}
                options={isFetching ? previousOptions : (metricOptions ?? [])}
                value={traceMetricSelectValue}
                loading={isFetching}
                menuTitle={t('Metrics')}
                onChange={(option: SelectOption<SelectKey>) => {
                  if ('metricType' in option) {
                    handleMetricChange(option as MetricSelectOption);
                  }
                }}
                disabled={hasNoMetrics}
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps}>
                    {traceMetric.name || t('Select a metric')}
                  </OverlayTrigger.Button>
                )}
              />
            </div>
          </Tooltip>
        </Stack>
        <Stack flex="1" gap="xs" maxWidth="425px">
          <div>
            <Tooltip
              title={t('The aggregation operation to apply to the metric.')}
              showUnderline
            >
              <SectionLabel>{t('Operation')}</SectionLabel>
            </Tooltip>
          </div>
          <StyledSelect
            search
            options={operationOptions}
            value={aggregation}
            onChange={handleOperationChange}
            disabled={hasNoMetrics || !traceMetric.name}
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps}>
                {aggregation || t('Select operation')}
              </OverlayTrigger.Button>
            )}
          />
        </Stack>
      </Flex>
    </Flex>
  );
}

const StyledSelect = styled(CompactSelect)`
  width: 100%;
  max-width: 425px;
  & > button {
    width: 100%;
    font-weight: normal;
  }
`;
