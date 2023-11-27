import {getMRIAndOp, getUseCaseFromMRI} from 'sentry/utils/metrics/mri';

export const isCustomMetricAggregate = (aggregate: string): boolean => {
  const parsed = getMRIAndOp(aggregate);
  return getUseCaseFromMRI(parsed?.mri) === 'custom';
};
