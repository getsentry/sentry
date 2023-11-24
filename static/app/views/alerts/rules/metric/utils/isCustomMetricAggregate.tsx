import {getMRI, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';

export const isCustomMetricAggregate = (aggregate: string): boolean => {
  const mri = getMRI(aggregate);
  return getUseCaseFromMRI(mri) === 'custom';
};
