import {getUseCaseFromMRI, parseField} from 'sentry/utils/metrics/mri';

export const isCustomMetricAggregate = (aggregate: string): boolean => {
  const parsed = parseField(aggregate);
  return getUseCaseFromMRI(parsed?.mri) === 'custom';
};
