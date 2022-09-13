import {SamplingInnerName} from 'sentry/types/sampling';

type SamplingRuleData = {
  conditions: SamplingInnerName[] | string[];
  conditions_stringified: string;
  sampling_rate: number | null;
};

type CommonSamplingData = {
  project_id: string;
  user_role?: string;
};

export type SamplingEventParameters = {
  'sampling.sdk.client.rate.change.alert': CommonSamplingData;
  'sampling.sdk.incompatible.alert': CommonSamplingData;
  'sampling.sdk.updgrades.alert': CommonSamplingData;
  'sampling.settings.modal.recommended.next.steps_back': CommonSamplingData;
  'sampling.settings.modal.recommended.next.steps_cancel': CommonSamplingData;
  'sampling.settings.modal.recommended.next.steps_done': CommonSamplingData;
  'sampling.settings.modal.recommended.next.steps_read_docs': CommonSamplingData;
  'sampling.settings.modal.specific.rule.condition_add': CommonSamplingData & {
    conditions: SamplingInnerName[] | string[];
  };
  'sampling.settings.modal.specify.client.open': CommonSamplingData;
  'sampling.settings.modal.specify.client.rate_cancel': CommonSamplingData;
  'sampling.settings.modal.specify.client.rate_next': CommonSamplingData;
  'sampling.settings.modal.specify.client.rate_read_docs': CommonSamplingData;
  'sampling.settings.modal.uniform.rate_cancel': CommonSamplingData;
  'sampling.settings.modal.uniform.rate_done': CommonSamplingData;
  'sampling.settings.modal.uniform.rate_next': CommonSamplingData;
  'sampling.settings.modal.uniform.rate_read_docs': CommonSamplingData;
  'sampling.settings.modal.uniform.rate_switch_current': CommonSamplingData;
  'sampling.settings.modal.uniform.rate_switch_recommended': CommonSamplingData;
  'sampling.settings.rule.specific_activate': CommonSamplingData & SamplingRuleData;
  'sampling.settings.rule.specific_create': CommonSamplingData & SamplingRuleData;
  'sampling.settings.rule.specific_deactivate': CommonSamplingData & SamplingRuleData;
  'sampling.settings.rule.specific_delete': CommonSamplingData & SamplingRuleData;
  'sampling.settings.rule.specific_save': CommonSamplingData & SamplingRuleData;
  'sampling.settings.rule.specific_update': CommonSamplingData &
    SamplingRuleData & {
      old_conditions: SamplingRuleData['conditions'];
      old_conditions_stringified: string;
      old_sampling_rate: SamplingRuleData['sampling_rate'];
    };
  'sampling.settings.rule.uniform_activate': CommonSamplingData & {
    sampling_rate: SamplingRuleData['sampling_rate'];
  };
  'sampling.settings.rule.uniform_create': CommonSamplingData & {
    old_sampling_rate: SamplingRuleData['sampling_rate'];
    sampling_rate: SamplingRuleData['sampling_rate'];
  };
  'sampling.settings.rule.uniform_deactivate': CommonSamplingData & {
    sampling_rate: SamplingRuleData['sampling_rate'];
  };
  'sampling.settings.rule.uniform_save': CommonSamplingData & {
    old_sampling_rate: SamplingRuleData['sampling_rate'];
    sampling_rate: SamplingRuleData['sampling_rate'];
  };
  'sampling.settings.rule.uniform_update': CommonSamplingData & {
    old_sampling_rate: SamplingRuleData['sampling_rate'];
    sampling_rate: SamplingRuleData['sampling_rate'];
  };
  'sampling.settings.view': CommonSamplingData;
  'sampling.settings.view_get_started': CommonSamplingData;
  'sampling.settings.view_read_docs': CommonSamplingData;
};

type SamplingAnalyticsKey = keyof SamplingEventParameters;

export const samplingEventMap: Record<SamplingAnalyticsKey, string> = {
  'sampling.sdk.client.rate.change.alert': 'Recommended sdk client rate change alert',
  'sampling.sdk.updgrades.alert': 'Recommended sdk upgrades alert',
  'sampling.sdk.incompatible.alert': 'Incompatible sdk upgrades alert',
  'sampling.settings.modal.recommended.next.steps_back': 'Go back to uniform rate step',
  'sampling.settings.modal.recommended.next.steps_cancel':
    'Cancel at recommended next steps step ',
  'sampling.settings.modal.recommended.next.steps_done':
    'Create uniform rule at recommended next steps step',
  'sampling.settings.modal.recommended.next.steps_read_docs':
    'Read docs at recommended next steps step',
  'sampling.settings.rule.specific_activate': 'Activate specific rule',
  'sampling.settings.modal.uniform.rate_cancel': 'Cancel at uniform rate step',
  'sampling.settings.rule.specific_deactivate': 'Deactivate specific rule',
  'sampling.settings.modal.uniform.rate_done': 'Create uniform rule at uniform rate step',
  'sampling.settings.modal.uniform.rate_next': 'Go to recommended next steps step',
  'sampling.settings.modal.uniform.rate_read_docs': 'Read docs at uniform rate step',
  'sampling.settings.modal.uniform.rate_switch_current':
    'Switch to current uniform rate step',
  'sampling.settings.modal.uniform.rate_switch_recommended':
    'Switch to recommended next steps step',
  'sampling.settings.modal.specific.rule.condition_add': 'Add sampling condition',
  'sampling.settings.modal.specify.client.rate_read_docs':
    'Read docs at specify client rate step',
  'sampling.settings.modal.specify.client.rate_cancel':
    'Cancel at specify client rate step',
  'sampling.settings.modal.specify.client.rate_next': 'Go to uniform rate step',
  'sampling.settings.modal.specify.client.open': 'Open specify client step',
  'sampling.settings.rule.specific_create': 'Create specific sampling rule',
  'sampling.settings.rule.specific_delete': 'Delete specific sampling rule',
  'sampling.settings.rule.specific_save': 'Save specific sampling rule', // fired for both create and update
  'sampling.settings.rule.specific_update': 'Update specific sampling rule',
  'sampling.settings.rule.uniform_activate': 'Activate uniform sampling rule',
  'sampling.settings.rule.uniform_create': 'Create uniform sampling rule',
  'sampling.settings.rule.uniform_deactivate': 'Deactivate uniform sampling rule',
  'sampling.settings.rule.uniform_save': 'Save uniform sampling rule', // fired for both create and update
  'sampling.settings.rule.uniform_update': 'Update uniform sampling rule',
  'sampling.settings.view': 'View sampling settings',
  'sampling.settings.view_get_started': 'Get started with sampling',
  'sampling.settings.view_read_docs': 'Read sampling docs', // fired for all read docs buttons
};
