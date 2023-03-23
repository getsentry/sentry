import {DynamicSamplingBiasType} from 'sentry/types/sampling';

export type DynamicSamplingEventParameters = {
  'dynamic_sampling_settings.priority_disabled': {
    id: DynamicSamplingBiasType;
    project_id: string;
  };
  'dynamic_sampling_settings.priority_enabled': {
    id: DynamicSamplingBiasType;
    project_id: string;
  };
};

type DynamicSamplingAnalyticsKey = keyof DynamicSamplingEventParameters;

export const dynamicSamplingEventMap: Record<DynamicSamplingAnalyticsKey, string> = {
  'dynamic_sampling_settings.priority_disabled': 'Disabled dynamic sampling priority',
  'dynamic_sampling_settings.priority_enabled': 'Enabled dynamic sampling priority',
};
