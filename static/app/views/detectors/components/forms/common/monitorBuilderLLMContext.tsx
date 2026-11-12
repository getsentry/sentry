import {useContext} from 'react';

import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

const CONTEXT_HINT =
  'Sentry monitor edit page. unsavedValues are the live form values, which may differ from the ' +
  'saved monitor — the user is mid-edit and has not submitted. Answer questions about the ' +
  'configuration from these values, not from a fetched copy of the monitor. Only fields this ' +
  'monitor type actually has are present; a field being absent does not mean it is blank.';

function MonitorBuilderNodeInner({detector}: {detector: Detector}) {
  const {form} = useContext(FormContext);

  const candidates = {
    name: useFormField<string>('name'),
    owner: useFormField<string>('owner'),
    projectId: useFormField<string>('projectId'),
    environment: useFormField<string>('environment'),
    description: useFormField<string>('description'),
    query: useFormField<string>('query'),
    workflowIds: useFormField<string[]>('workflowIds'),
  };

  // `FormModel.getValue` returns '' for a field the form does not define — see
  // the XXX in components/forms/model.tsx — so an unfiltered list would report
  // an empty `query` on a cron edit, which has no query at all. Reporting a
  // field a type lacks as blank is worse than omitting it, because the hint
  // above tells the reader to trust these values.
  const unsavedValues = Object.fromEntries(
    Object.entries(candidates).filter(([field]) => form?.fields.has(field))
  );

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
