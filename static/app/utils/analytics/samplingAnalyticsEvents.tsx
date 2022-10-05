import {SamplingInnerName} from 'sentry/types/sampling';

type Rule = {
  conditions: SamplingInnerName[] | string[];
  conditions_stringified: string;
  project_id: string;
  sampling_rate: number | null;
};

export type SamplingEventParameters = {
  'sampling.performance.metrics.accuracy.alert': {
    project_id: string;
  };
  'sampling.sdk.client.rate.change.alert': {
    project_id: string;
  };
  'sampling.sdk.incompatible.alert': {
    project_id: string;
  };
  'sampling.sdk.updgrades.alert': {
    project_id: string;
  };
  'sampling.settings.modal.recommended.next.steps_back': {
    project_id: string;
  };
  'sampling.settings.modal.recommended.next.steps_cancel': {
    project_id: string;
  };
  'sampling.settings.modal.recommended.next.steps_done': {
    project_id: string;
  };
  'sampling.settings.modal.recommended.next.steps_read_docs': {
    project_id: string;
  };
  'sampling.settings.modal.specific.rule.condition_add': {
    conditions: SamplingInnerName[] | string[];
    project_id: string;
  };
  'sampling.settings.modal.specify.client.open': {
    project_id: string;
  };
  'sampling.settings.modal.specify.client.rate_cancel': {
    project_id: string;
  };
  'sampling.settings.modal.specify.client.rate_next': {
    project_id: string;
  };
  'sampling.settings.modal.specify.client.rate_read_docs': {
    project_id: string;
  };
  'sampling.settings.modal.uniform.rate_cancel': {
    project_id: string;
  };
  'sampling.settings.modal.uniform.rate_done': {
    project_id: string;
  };
  'sampling.settings.modal.uniform.rate_next': {
    project_id: string;
  };
  'sampling.settings.modal.uniform.rate_read_docs': {
    project_id: string;
  };
  'sampling.settings.modal.uniform.rate_switch_current': {
    project_id: string;
  };
  'sampling.settings.modal.uniform.rate_switch_recommended': {
    project_id: string;
  };
  'sampling.settings.rule.specific_activate': Rule;
  'sampling.settings.rule.specific_create': Rule;
  'sampling.settings.rule.specific_deactivate': Rule;
  'sampling.settings.rule.specific_delete': Rule;
  'sampling.settings.rule.specific_save': Rule;
  'sampling.settings.rule.specific_update': Rule & {
    old_conditions: Rule['conditions'];
    old_conditions_stringified: string;
    old_sampling_rate: Rule['sampling_rate'];
  };
  'sampling.settings.rule.uniform_activate': {
    project_id: string;
    sampling_rate: Rule['sampling_rate'];
  };
  'sampling.settings.rule.uniform_create': {
    old_sampling_rate: Rule['sampling_rate'];
    project_id: string;
    sampling_rate: Rule['sampling_rate'];
  };
  'sampling.settings.rule.uniform_deactivate': {
    project_id: string;
    sampling_rate: Rule['sampling_rate'];
  };
  'sampling.settings.rule.uniform_save': {
    old_sampling_rate: Rule['sampling_rate'];
    project_id: string;
    sampling_rate: Rule['sampling_rate'];
  };
  'sampling.settings.rule.uniform_update': {
    old_sampling_rate: Rule['sampling_rate'];
    project_id: string;
    sampling_rate: Rule['sampling_rate'];
  };
  'sampling.settings.view': {project_id: string};
  'sampling.settings.view_get_started': {
    project_id: string;
  };
  'sampling.settings.view_read_docs': {
    project_id: string;
  };
};

type SamplingAnalyticsKey = keyof SamplingEventParameters;

export const samplingEventMap: Record<SamplingAnalyticsKey, string> = {
  'sampling.performance.metrics.accuracy.alert':
    'Sampling Performance Metrics Accuracy Alert',
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
