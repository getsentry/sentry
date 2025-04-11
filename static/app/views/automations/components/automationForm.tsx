import {useEffect} from 'react';
import styled from '@emotion/styled';

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
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
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

const model = new FormModel({
  initialData: {
    name: t('New Monitor'),
    'when.action_match': 'any',
    'if[0].action_match': 'any',
    frequency: '10',
  },
});

export default function AutomationForm() {
  const title = useDocumentTitle();

  useEffect(() => {
    model.setValue('name', title);
  }, [title]);

  // TODO: BROKEN AF
  // useEffect(() => {
  //   model.setInitialData({
  //     name: title,
  //     'when.action_match': 'any',
  //     'if_0.action_match': 'any',
  //     frequency: '10',
  //   });

  //   const prevHook = model.options.onFieldChange;
  //   model.setFormOptions({
  //     onFieldChange(id, value) {
  //       if (!id.startsWith('if_')) {
  //         prevHook?.(id, value);
  //         return;
  //       }
  //       const data = model.getData();
  //       const blocks = Object.keys(data)
  //         .filter(key => key.startsWith('if_'))
  //         .map(key => {
  //           const parts = key.split('_');
  //           if (parts.length < 2 || !parts[1]) return undefined;
  //           const num = parseInt(parts[1], 10);
  //           return isNaN(num) ? undefined : num;
  //         })
  //         .filter((num): num is number => num !== undefined);

  //       setIfThenBlocks(blocks);

  //       prevHook?.(id, value);
  //     },
  //   });
  // }, [title]);

  return (
    <Form hideFooter model={model}>
      <Flex column gap={space(1.5)} style={{padding: space(2)}}>
        <CollapsibleSection title={t('Connect Monitors')} open>
          {/* TODO: fix margins on SimpleTable */}
          <StyledConnectedMonitorsList monitors={[]} />
          <ButtonWrapper justify="space-between">
            <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
            <Button icon={<IconEdit />}>{t('Edit Monitors')}</Button>
          </ButtonWrapper>
        </CollapsibleSection>
        <CollapsibleSection title={t('Automation Builder')} open>
          <AutomationBuilder model={model} />
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
      </Flex>
      <DebugForm />
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
