import {t} from 'sentry/locale';
import type {
  MetricAggregation,
  MetricType,
  MRI,
  ParsedMRI,
  UseCase,
} from 'sentry/types/metrics';
import {parseFunction} from 'sentry/utils/discover/fields';

export const DEFAULT_MRI: MRI = 'c:custom/sentry_metric@none';
export const DEFAULT_SPAN_MRI: MRI = 'c:custom/span_attribute_0@none';
// This is a workaround as the alert builder requires a valid aggregate to be set
export const DEFAULT_METRIC_ALERT_FIELD = `sum(${DEFAULT_MRI})`;

export const DEFAULT_EAP_FIELD = 'span.duration';
export const DEFAULT_EAP_METRICS_ALERT_FIELD = `count(${DEFAULT_EAP_FIELD})`;

export function isMRI(mri?: unknown): mri is MRI {
  if (typeof mri !== 'string') {
    return false;
  }
  try {
    _parseMRI(mri);
    return true;
  } catch {
    return false;
  }
}

type ParseResult<T extends MRI | string | null> = T extends MRI
  ? ParsedMRI
  : ParsedMRI | null;
export function parseMRI<T extends MRI | string | null>(mri?: T): ParseResult<T> {
  if (!mri) {
    // TODO: How can this be done without casting?
    return null as ParseResult<T>;
  }
  try {
    return _parseMRI(mri) as ParseResult<T>;
  } catch {
    return null as ParseResult<T>;
  }
}

function _parseMRI(mri: string): ParsedMRI {
  const mriArray = mri.split(new RegExp(/[:/@]/));

  if (mriArray.length !== 4) {
    throw new Error('Invalid MRI');
  }

  const [metricType, useCase, name, unit] = mriArray;

  return {
    type: metricType as MetricType,
    name: parseName(name!, useCase as UseCase),
    unit: unit!,
    useCase: useCase as UseCase,
  };
}

function parseName(name: string, useCase: UseCase): string {
  if (useCase === 'custom') {
    return name;
  }
  if (useCase === 'transactions') {
    if (name === 'duration') {
      return 'transaction.duration';
    }
    return name;
  }
  if (useCase === 'spans') {
    if (['duration', 'self_time', 'exclusive_time'].includes(name)) {
      return `span.${name}`;
    }
    return name;
  }

  return `${useCase}.${name}`;
}

export function toMRI({type, useCase, name, unit}: ParsedMRI): MRI {
  return `${type}:${useCase}/${name}@${unit}`;
}

export function formatMRI(mri: MRI): string {
  return parseMRI(mri)?.name;
}

export function getUseCaseFromMRI(mri?: string): UseCase | undefined {
  const parsed = parseMRI(mri);

  return parsed?.useCase;
}

export function MRIToField(mri: MRI, aggregation: MetricAggregation): string {
  return `${aggregation}(${mri})`;
}

export function parseField(
  field: string
): {aggregation: MetricAggregation; mri: MRI} | null {
  const parsedFunction = parseFunction(field);
  if (!parsedFunction) {
    return null;
  }
  return {
    mri: parsedFunction.arguments[0] as MRI,
    aggregation: parsedFunction.name as MetricAggregation,
  };
}

export function isMRIField(field: string): boolean {
  return !!parseMRI(parseField(field)?.mri);
}

// convenience function to get the MRI from a field, returns defaut MRI if it fails
export function getMRI(field: string): MRI {
  const parsed = parseField(field);
  return parsed?.mri ?? DEFAULT_MRI;
}

export function formatMRIField(aggregate: string) {
  if (aggregate === DEFAULT_METRIC_ALERT_FIELD) {
    return t('Select a metric to get started');
  }

  const parsed = parseField(aggregate);

  // The field does not contain an MRI -> return the aggregate as is
  if (!parsed || !parsed.mri) {
    return aggregate;
  }

  return `${parsed.aggregation}(${formatMRI(parsed.mri)})`;
}
