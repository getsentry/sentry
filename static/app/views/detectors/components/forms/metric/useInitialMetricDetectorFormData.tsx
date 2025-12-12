import type {Organization} from 'sentry/types/organization';
import {generateFieldAsString, parseFunction} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DEFAULT_THRESHOLD_METRIC_FORM_DATA,
  type MetricDetectorFormData,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

function getLocationDataset(
  query: Record<string, string | string[] | undefined | null>
): DetectorDataset {
  const raw = decodeScalar(query.dataset);
  if (!raw) {
    return DEFAULT_THRESHOLD_METRIC_FORM_DATA.dataset;
  }
  const candidate = raw.toLowerCase() as DetectorDataset;
  return Object.values(DetectorDataset).includes(candidate)
    ? candidate
    : DEFAULT_THRESHOLD_METRIC_FORM_DATA.dataset;
}

function getLocationAggregate(
  query: Record<string, string | string[] | undefined | null>,
  datasetConfig: ReturnType<typeof getDatasetConfig>,
  organization: Organization
): string | undefined {
  const raw = decodeScalar(query.aggregate);
  if (!raw) {
    return undefined;
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
  const location = useLocation();
  const organization = useOrganization();
  const dataset = getLocationDataset(location.query);
  const datasetConfig = getDatasetConfig(dataset);
  const defaultAggregate = generateFieldAsString(datasetConfig.defaultField);
  const aggregateFromUrl = getLocationAggregate(
    location.query,
    datasetConfig,
    organization
  );
  const queryFromUrl = decodeScalar(location.query.query);
  const defaultQuery = DEFAULT_THRESHOLD_METRIC_FORM_DATA.query ?? '';
  const query = queryFromUrl === undefined ? defaultQuery : queryFromUrl;
  const environmentFromUrl = decodeScalar(location.query.environment, '') ?? '';
  const nameFromUrl = decodeScalar(location.query.name, '') ?? '';

  return {
    ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
    dataset,
    aggregateFunction: aggregateFromUrl ?? defaultAggregate,
    query,
    environment: environmentFromUrl,
    name: nameFromUrl,
  } satisfies Partial<MetricDetectorFormData>;
}
