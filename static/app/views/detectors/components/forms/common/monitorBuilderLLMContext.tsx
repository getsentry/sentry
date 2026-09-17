import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

const CONTEXT_HINT =
  'Sentry monitor edit page. unsavedValues are the live form values, which may differ from the ' +
  'saved monitor — the user is mid-edit and has not submitted. Answer questions about the ' +
  'configuration from these values, not from a fetched copy of the monitor.';

function MonitorBuilderNodeInner({detector}: {detector: Detector}) {
  // Keys a given monitor type lacks come back undefined and drop out of the
  // serialized snapshot, so one list covers every type using this form.
  const unsavedValues = {
    name: useFormField<string>('name'),
    owner: useFormField<string>('owner'),
    projectId: useFormField<string>('projectId'),
    environment: useFormField<string>('environment'),
    description: useFormField<string>('description'),
    query: useFormField<string>('query'),
    connectedAlertIds: useFormField<string[]>('workflowIds'),
  };

  useLLMContext({
    // Outranks the page nodes beneath it, so a monitor being edited wins.
    priority: 1,
    contextHint: CONTEXT_HINT,
    mode: 'editing',
    id: detector.id,
    type: detector.type,
    unsavedValues,
  });

  return null;
}

/**
 * Reports the monitor being edited. Renders nothing.
 *
 * Must render beneath the form's `FormContext`, since that is what
 * `useFormField` resolves against — a hook in the component that *renders* the
 * provider sees no form.
 */
export const MonitorBuilderNode = registerLLMContext(
  'monitor-builder',
  MonitorBuilderNodeInner
);
