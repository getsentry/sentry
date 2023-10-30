import {DynamicSamplingBiasType} from 'sentry/types/sampling';

export type DynamicSamplingEventParameters = {
  'dynamic_sampling.custom_rule_add': {
    projects: number[];
    query: string;
    success: boolean;
  };
  'dynamic_sampling_settings.priority_disabled': {
    id: DynamicSamplingBiasType;
    project_id: string;
  };
  'dynamic_sampling_settings.priority_enabled': {
    id: DynamicSamplingBiasType;
    project_id: string;
  };
  'dynamic_sampling_transaction_summary.baseline': {
    query: string;
  };
  'dynamic_sampling_transaction_summary.no_samples': {
    query: string;
  };
};

type DynamicSamplingAnalyticsKey = keyof DynamicSamplingEventParameters;

export const dynamicSamplingEventMap: Record<DynamicSamplingAnalyticsKey, string> = {
  'dynamic_sampling_settings.priority_disabled': 'Disabled dynamic sampling priority',
  'dynamic_sampling_settings.priority_enabled': 'Enabled dynamic sampling priority',
  'dynamic_sampling_transaction_summary.baseline':
    'Dynamic Sampling: Transaction overview baseline',
  'dynamic_sampling_transaction_summary.no_samples':
    'Dynamic Sampling: Transaction without samples',
  'dynamic_sampling.custom_rule_add': 'Dynamic Sampling Custom rule add',
};
