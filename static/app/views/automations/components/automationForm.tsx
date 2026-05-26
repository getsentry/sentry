import {useCallback} from 'react';

import {Flex} from '@sentry/scraps/layout';

import type {FormModel} from 'sentry/components/forms/model';
import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {AutomationBuilder} from 'sentry/views/automations/components/automationBuilder';
import {EditConnectedMonitors} from 'sentry/views/automations/components/editConnectedMonitors';
import {ActionThrottleSelectField} from 'sentry/views/automations/components/forms/actionThrottleSelectField';
import {useSetAutomaticAutomationName} from 'sentry/views/automations/components/forms/useSetAutomaticAutomationName';

export function AutomationForm({model}: {model: FormModel}) {
  const initialConnectedIds = useFormField<Automation['detectorIds']>('detectorIds');
  const setConnectedIds = useCallback(
    (ids: Automation['detectorIds']) => {
      model.setValue('detectorIds', ids);
    },
    [model]
  );

  useSetAutomaticAutomationName();

  return (
    <Flex direction="column" gap="lg">
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
    </Flex>
  );
}
