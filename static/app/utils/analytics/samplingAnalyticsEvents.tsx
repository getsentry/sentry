import {SamplingInnerName} from 'sentry/types/sampling';

type Rule = {
  conditions: SamplingInnerName[] | string[];
  conditions_stringified: string;
  project_id: string;
  sampling_rate: number | null;
};

export type SamplingEventParameters = {
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
  'sampling.settings.modal.specific.rule.condition_add': 'Add Sampling Condition',
  'sampling.settings.rule.specific_create': 'Create Specific Sampling Rule',
  'sampling.settings.rule.specific_delete': 'Delete Specific Sampling Rule',
  'sampling.settings.rule.specific_save': 'Save Specific Sampling Rule', // fired for both create and update
  'sampling.settings.rule.specific_update': 'Update Specific Sampling Rule',
  'sampling.settings.rule.uniform_activate': 'Activate Uniform Sampling Rule',
  'sampling.settings.rule.uniform_create': 'Create Uniform Sampling Rule',
  'sampling.settings.rule.uniform_deactivate': 'Deactivate Uniform Sampling Rule',
  'sampling.settings.rule.uniform_update': 'Update Uniform Sampling Rule',
  'sampling.settings.view': 'View Sampling Settings',
  'sampling.settings.view_get_started': 'Get Started with Sampling',
  'sampling.settings.view_read_docs': 'Read Sampling Docs', // fired for all read docs buttons
};
