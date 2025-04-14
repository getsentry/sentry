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
import CollapsibleSection from 'sentry/components/workflowEngine/ui/collapsibleSection';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
import {
  AutomationBuilderContext,
  type AutomationBuilderState,
} from 'sentry/views/automations/components/automationBuilderState';
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

const initialState: AutomationBuilderState = {
  triggers: {
    id: 'when',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [],
  },
  actionFilters: [
    {id: 'if.0', logicType: DataConditionGroupLogicType.ANY, conditions: []},
  ],
};

const model = new FormModel(flattie(initialState));

export default function AutomationForm() {
  const title = useDocumentTitle();
  const [state, setState] = useState<AutomationBuilderState>(() => initialState);

  useEffect(() => {
    const flattened = flattie(state);
    model.setInitialData(flattened);
  });

  useEffect(() => {
    model.setValue('name', title);
  }, [title]);

  return (
    <Form hideFooter model={model}>
      <AutomationBuilderContext.Provider value={{state, setState}}>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <CollapsibleSection title={t('Connect Monitors')} open>
            <StyledConnectedMonitorsList monitors={[]} />
            <ButtonWrapper justify="space-between">
              <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
              <Button icon={<IconEdit />}>{t('Edit Monitors')}</Button>
            </ButtonWrapper>
          </CollapsibleSection>
          <CollapsibleSection title={t('Automation Builder')} open>
            <AutomationBuilder />
          </CollapsibleSection>
          <CollapsibleSection
            title={t('Action Interval')}
            description={t('Perform the set actions once per set interval')}
            open
          >
            <EmbeddedSelectField
              name="frequency"
              inline={false}
              clearable={false}
              options={FREQUENCY_OPTIONS}
            />
          </CollapsibleSection>
          <DebugForm />
        </Flex>
      </AutomationBuilderContext.Provider>
    </Form>
  );
}

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
