import {t} from 'sentry/locale';
import {MetricType, MRI, ParsedMRI, UseCase} from 'sentry/types/metrics';
import {parseFunction} from 'sentry/utils/discover/fields';

export const DEFAULT_MRI: MRI = 'c:custom/sentry_metric@none';
// This is a workaround as the alert builder requires a valid aggregate to be set
export const DEFAULT_METRIC_ALERT_FIELD = `sum(${DEFAULT_MRI})`;

export function isMRI(mri?: unknown): mri is MRI {
  return !!parseMRI(mri);
}

export function parseMRI(mri?: unknown): ParsedMRI | null {
  if (!mri) {
    return null;
  }
  try {
    return _parseMRI(mri as MRI);
  } catch (e) {
    return null;
  }
}

function _parseMRI(mri: MRI): ParsedMRI {
  const mriArray = mri.split(new RegExp(/[:/@]/));

  if (mriArray.length !== 4) {
    throw new Error('Invalid MRI');
  }

  const [metricType, useCase, name, unit] = mriArray;

  return {
    type: metricType as MetricType,
    name: parseName(name, useCase as UseCase),
    unit,
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
  return `${useCase}.${name}`;
}

export function toMRI({type, useCase, name, unit}: ParsedMRI): MRI {
  return `${type}:${useCase}/${name}@${unit}`;
}

export function formatMRI(mri: MRI): string {
  return parseMRI(mri)?.name ?? mri;
}

export function getUseCaseFromMRI(mri?: string): UseCase | undefined {
  const parsed = parseMRI(mri);

  return parsed?.useCase;
}

export function MRIToField(mri: MRI, op: string): string {
  return `${op}(${mri})`;
}

export function parseField(field: string): {mri: MRI; op: string} | null {
  const parsedFunction = parseFunction(field);
  if (!parsedFunction) {
    return null;
  }
  return {
    mri: parsedFunction.arguments[0] as MRI,
    op: parsedFunction.name,
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

  return `${parsed.op}(${formatMRI(parsed.mri)})`;
}
