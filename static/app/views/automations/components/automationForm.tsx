import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import SelectField from 'sentry/components/forms/fields/selectField';
import type FormModel from 'sentry/components/forms/model';
import {DebugForm} from 'sentry/components/workflowEngine/form/debug';
import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';

const FREQUENCY_OPTIONS = [
  {value: 5, label: t('5 minutes')},
  {value: 10, label: t('10 minutes')},
  {value: 30, label: t('30 minutes')},
  {value: 60, label: t('60 minutes')},
  {value: 180, label: t('3 hours')},
  {value: 720, label: t('12 hours')},
  {value: 1440, label: t('24 hours')},
  {value: 10080, label: t('1 week')},
  {value: 43200, label: t('30 days')},
];

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

  return (
    <Flex direction="column" gap="lg">
      <EditConnectedMonitors
        connectedIds={initialConnectedIds || []}
        setConnectedIds={setConnectedIds}
      />
      <Card>
        <Flex direction="column" gap="xs">
          <Heading>{t('Choose Environment')}</Heading>
          <Description>
            {t(
              'If you select environments different than your monitors then the automation will not fire.'
            )}
          </Description>
        </Flex>
        <EnvironmentSelector value={environment} onChange={updateEnvironment} />
      </Card>
      <Card>
        <Heading>{t('Automation Builder')}</Heading>
        <AutomationBuilder />
      </Card>
      <Card>
        <Heading>{t('Action Interval')}</Heading>
        <EmbeddedSelectField
          required
          name="frequency"
          inline={false}
          clearable={false}
          options={FREQUENCY_OPTIONS}
        />
      </Card>
      <DebugForm />
    </Flex>
  );
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSize.xl};
  margin: 0;
`;

const Description = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  margin: 0;
  padding: 0;
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeight.normal};
  text-transform: none;
`;
