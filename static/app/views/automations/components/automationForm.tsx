import {useCallback, useState} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type FormModel from 'sentry/components/forms/model';
import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';
import {ActionIntervalSelectField} from 'sentry/views/automations/components/forms/actionIntervalSelectField';
import {useSetAutomaticAutomationName} from 'sentry/views/automations/components/forms/useSetAutomaticAutomationName';

export default function AutomationForm({model}: {model: FormModel}) {
  const initialConnectedIds = useFormField<Automation['detectorIds']>('detectorIds');
  const setConnectedIds = useCallback(
    (ids: Automation['detectorIds']) => {
      model.setValue('detectorIds', ids);
    },
    [model]
  );

  const [environment, setEnvironment] = useState<string>('');
  const updateEnvironment = (env: string) => {
    setEnvironment(env);
    model.setValue('environment', env || null);
  };

  useSetAutomaticAutomationName();

  return (
    <Flex direction="column" gap="lg">
      <EditConnectedMonitors
        connectedIds={initialConnectedIds || []}
        setConnectedIds={setConnectedIds}
      />
      <Card>
        <Flex direction="column" gap="sm">
          <Heading as="h2" size="lg">
            {t('Choose Environment')}
          </Heading>
          <Text size="sm" variant="muted">
            {t(
              'If you select environments different than your monitors then the automation will not fire.'
            )}
          </Text>
        </Flex>
        <EnvironmentSelector value={environment} onChange={updateEnvironment} />
      </Card>
      <Card>
        <Heading as="h2" size="lg">
          {t('Alert Builder')}
        </Heading>
        <AutomationBuilder />
      </Card>
      <Card>
        <Flex direction="column" gap="sm">
          <Heading as="h2" size="lg">
            {t('Action Interval')}
          </Heading>
          <Text size="sm" variant="muted">
            {t('Perform the actions above this often for an issue.')}
          </Text>
        </Flex>
        <ActionIntervalSelectField />
      </Card>
    </Flex>
  );
}
