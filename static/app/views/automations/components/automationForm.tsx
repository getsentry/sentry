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

  return (
    <Form
      hideFooter
      model={model}
      initialData={{...flattie(initialAutomationBuilderState), frequency: '1440'}}
    >
      <AutomationBuilderContext.Provider value={{state, actions}}>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <SectionBody>
            <Heading>{t('Connect Monitors')}</Heading>
            <StyledConnectedMonitorsList monitors={[]} />
            <ButtonWrapper justify="space-between">
              <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
              <Button icon={<IconEdit />}>{t('Edit Monitors')}</Button>
            </ButtonWrapper>
          </SectionBody>
          <SectionBody>
            <Heading>{t('Automation Builder')}</Heading>
            <AutomationBuilder />
          </SectionBody>
          <SectionBody>
            <Heading>{t('Action Interval')}</Heading>
            <EmbeddedSelectField
              name="frequency"
              inline={false}
              clearable={false}
              options={FREQUENCY_OPTIONS}
            />
          </SectionBody>
          <DebugForm />
        </Flex>
      </AutomationBuilderContext.Provider>
    </Form>
  );
}

const SectionBody = styled('div')`
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(2)};
`;

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1.5)};
`;

const StyledConnectedMonitorsList = styled(ConnectedMonitorsList)`
  margin: ${space(2)} 0;
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
