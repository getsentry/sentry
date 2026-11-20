import type {RefObject} from 'react';
import {useOutletContext} from 'react-router';

import {Alert} from '@sentry/scraps/alert';

import {NotFound} from 'sentry/components/errors/notFound';
import {t} from 'sentry/locale';
import {AgenticTriageForm} from 'sentry/views/seerWorkflows/automations/agenticTriageForm';
import {
  MetricAutomationForm,
  type MetricAutomationFormHandle,
} from 'sentry/views/seerWorkflows/automations/metricAutomationForm';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

export type AutomationDetailOutletContext = {
  config: SeerWorkflowConfigResponse;
  formId: string;
  formRef: RefObject<MetricAutomationFormHandle | null>;
  isConfiguring: boolean;
  name: string;
  onSaved: () => void;
  setFormHasChanges: (hasChanges: boolean) => void;
  setMonitorsPending: (pending: boolean) => void;
};

export default function AutomationConfiguration() {
  const context = useOutletContext<AutomationDetailOutletContext | undefined>();

  if (context?.config.strategy === 'breached_metric_investigation') {
    return (
      <MetricAutomationForm
        mode="edit"
        config={context.config}
        formId={context.formId}
        formRef={context.formRef}
        onSaved={context.onSaved}
        readOnly={!context.isConfiguring}
        name={context.name}
        setFormHasChanges={context.setFormHasChanges}
        setMonitorsPending={context.setMonitorsPending}
      />
    );
  }

  if (context?.config.strategy === 'agentic_triage_v2') {
    return (
      <AgenticTriageForm
        mode="edit"
        config={context.config}
        formId={context.formId}
        formRef={context.formRef}
        onSaved={context.onSaved}
        readOnly={!context.isConfiguring}
        name={context.name}
        setFormHasChanges={context.setFormHasChanges}
      />
    );
  }

  if (!context) {
    return <NotFound />;
  }

  return (
    <Alert variant="danger">
      {t('Strategy %s not supported', context.config.strategy)}
    </Alert>
  );
}
