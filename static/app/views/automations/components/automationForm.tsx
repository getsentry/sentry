import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {flattie} from 'flattie';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DebugForm} from 'sentry/components/workflowEngine/form/debug';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
import {
  AutomationBuilderContext,
  initialAutomationBuilderState,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {useConnectedMonitors} from 'sentry/views/automations/components/editConnectedMonitors';

const FREQUENCY_OPTIONS = [
  {value: '5', label: t('5 minutes')},
  {value: '10', label: t('10 minutes')},
  {value: '30', label: t('30 minutes')},
  {value: '60', label: t('60 minutes')},
  {value: '180', label: t('3 hours')},
  {value: '720', label: t('12 hours')},
  {value: '1440', label: t('24 hours')},
  {value: '10080', label: t('1 week')},
  {value: '43200', label: t('30 days')},
];

export default function AutomationForm() {
  const title = useDocumentTitle();
  const {state, actions} = useAutomationBuilderReducer();
  const [model] = useState(() => new FormModel());

  useEffect(() => {
    model.setValue('name', title);
  }, [title, model]);

  const {monitors, connectedMonitorIds, toggleConnected} = useConnectedMonitors();
  const connectedMonitors = monitors.filter(monitor =>
    connectedMonitorIds.has(monitor.id)
  );

  return (
    <Form
      hideFooter
      model={model}
      initialData={{...flattie(initialAutomationBuilderState), frequency: '1440'}}
    >
      <AutomationBuilderContext.Provider value={{state, actions}}>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <Card>
            <Heading>{t('Connect Monitors')}</Heading>
            <ConnectedMonitorsList
              monitors={connectedMonitors}
              connectedMonitorIds={connectedMonitorIds}
              toggleConnected={toggleConnected}
            />
            <ButtonWrapper justify="space-between">
              <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
              <Button icon={<IconEdit />}>{t('Edit Monitors')}</Button>
            </ButtonWrapper>
          </Card>
          <Card>
            <Heading>{t('Automation Builder')}</Heading>
            <AutomationBuilder />
          </Card>
          <Card>
            <Heading>{t('Action Interval')}</Heading>
            <EmbeddedSelectField
              name="frequency"
              inline={false}
              clearable={false}
              options={FREQUENCY_OPTIONS}
            />
          </Card>
          <DebugForm />
        </Flex>
      </AutomationBuilderContext.Provider>
    </Form>
  );
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  margin: -${space(2)};
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
`;
