import {memo, useCallback} from 'react';

import {Stack} from '@sentry/scraps/layout';

import type {FormModel} from 'sentry/components/forms/model';
import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationAlertPreview} from 'sentry/views/automations/components/automationAlertPreview';
import {AutomationBuilder} from 'sentry/views/automations/components/automationBuilder';
import {EditConnectedMonitors} from 'sentry/views/automations/components/editConnectedMonitors';
import {ActionThrottleSelectField} from 'sentry/views/automations/components/forms/actionThrottleSelectField';
import {useSetAutomaticAutomationName} from 'sentry/views/automations/components/forms/useSetAutomaticAutomationName';

// Reads the builder context, so it lives in its own component to keep
// AutomationForm from re-rendering on every builder change
function AutomaticAutomationName() {
  useSetAutomaticAutomationName();
  return null;
}

// Memoized so builder edits (which re-render the page root) only re-render the
// builder subtree via context, not the monitors, environment and throttle fields
export const AutomationForm = memo(function AutomationForm({model}: {model: FormModel}) {
  const organization = useOrganization();
  const initialConnectedIds = useFormField<Automation['detectorIds']>('detectorIds');
  const setConnectedIds = useCallback(
    (ids: Automation['detectorIds']) => {
      model.setValue('detectorIds', ids);
    },
    [model]
  );

  return (
    <Stack gap="lg">
      <AutomaticAutomationName />
      <EditConnectedMonitors
        connectedIds={initialConnectedIds || []}
        setConnectedIds={setConnectedIds}
      />
      <Card>
        <FormSection
          title={t('Filter Issues')}
          description={t('Only get alerted on Issues from these environments.')}
        >
          <EnvironmentSelector />
        </FormSection>
      </Card>
      <Card>
        <FormSection title={t('Alert Builder')}>
          <AutomationBuilder />
        </FormSection>
      </Card>
      <Card>
        <FormSection
          title={t('Throttling')}
          description={t('Set how often this alert can be triggered for a given issue.')}
        >
          <ActionThrottleSelectField />
        </FormSection>
      </Card>
      {organization.features.includes('workflow-alert-previews') && (
        <Card>
          <FormSection
            title={t('Preview Alerts')}
            description={t(
              'See an estimation of which issues would have triggered this alert over the past 7 days. '
            )}
          >
            <AutomationAlertPreview />
          </FormSection>
        </Card>
      )}
    </Stack>
  );
});
