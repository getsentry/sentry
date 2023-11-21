import {fieldToMri, getUseCaseFromMRI} from 'sentry/utils/metrics';

export const isCustomMetricAggregate = (aggregate: string): boolean => {
  const {mri} = fieldToMri(aggregate);
  return getUseCaseFromMRI(mri) === 'custom';
};
