import {parseAsString, useQueryStates} from 'nuqs';

import type {Organization} from 'sentry/types/organization';
import {
  generateFieldAsString,
  isEquation,
  parseFunction,
} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DEFAULT_THRESHOLD_METRIC_FORM_DATA} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormFields';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {isTraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

function getLocationDataset(raw: string | null): DetectorDataset {
  if (!raw) {
    return DEFAULT_THRESHOLD_METRIC_FORM_DATA.dataset;
  }
  const candidate = raw.toLowerCase() as DetectorDataset;
  return Object.values(DetectorDataset).includes(candidate)
    ? candidate
    : DEFAULT_THRESHOLD_METRIC_FORM_DATA.dataset;
}

function getLocationAggregate(
  raw: string | null,
  dataset: DetectorDataset,
  datasetConfig: ReturnType<typeof getDatasetConfig>,
  organization: Organization
): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (datasetConfig.supportsEquations && isEquation(raw)) {
    return raw;
  }

  if (dataset === DetectorDataset.METRICS) {
    const {aggregation, traceMetric} = parseMetricAggregate(raw);
    if (!traceMetric.name || !isTraceMetricTypeValue(traceMetric.type)) {
      return undefined;
    }

    return OPTIONS_BY_TYPE[traceMetric.type]?.some(option => option.value === aggregation)
      ? raw
      : undefined;
  }

  const parsedAggregate = parseFunction(raw);
  if (!parsedAggregate) {
    return undefined;
  }

  const options = datasetConfig.getAggregateOptions(organization);
  const allowed = Object.values(options).map(option => option.value.meta.name);
  return allowed.includes(parsedAggregate?.name) ? raw : undefined;
}

export function useInitialMetricDetectorFormData(): Partial<MetricDetectorFormData> {
  const [urlParams] = useQueryStates({
    aggregate: parseAsString,
    dataset: parseAsString,
    query: parseAsString,
  });
  const organization = useOrganization();
  const dataset = getLocationDataset(urlParams.dataset);
  const datasetConfig = getDatasetConfig(dataset);
  const defaultAggregate = generateFieldAsString(datasetConfig.defaultField);
  const aggregateFromUrl = getLocationAggregate(
    urlParams.aggregate,
    dataset,
    datasetConfig,
    organization
  );
  const query = urlParams.query ?? DEFAULT_THRESHOLD_METRIC_FORM_DATA.query ?? '';

  return {
    ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
    dataset,
    aggregateFunction: aggregateFromUrl ?? defaultAggregate,
    query,
  } satisfies Partial<MetricDetectorFormData>;
}
