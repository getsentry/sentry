import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DebugForm} from 'sentry/components/workflowEngine/form/debug';
import CollapsibleSection from 'sentry/components/workflowEngine/ui/collapsibleSection';
import {IconAdd, IconDelete, IconEdit, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import RuleNodeList from 'sentry/views/automations/components/ruleNodeList';

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

const TRIGGER_MATCH_OPTIONS = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
];

const FILTER_MATCH_OPTIONS = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
  {value: 'none', label: t('none')},
];

const model = new FormModel({
  initialData: {
    name: t('New Monitor'),
    'when.action_match': 'any',
    'if_0.action_match': 'any',
    frequency: '10',
  },
});

function IfThenBlock({
  id,
  onDelete,
}: {
  id: number;
  onDelete: () => void;
  totalBlocks: number;
}) {
  return (
    <IfThenWrapper key={id}>
      <Flex column gap={space(1)}>
        <Flex justify="space-between">
          <StepLead>
            {tct('[if:If] [selector] of these filters match', {
              if: <Badge />,
              selector: (
                <EmbeddedWrapper>
                  <EmbeddedSelectField
                    styles={{
                      control: (provided: any) => ({
                        ...provided,
                        minHeight: '21px',
                        height: '21px',
                      }),
                    }}
                    inline={false}
                    isSearchable={false}
                    isClearable={false}
                    name={`if_${id}.action_match`}
                    required
                    flexibleControlStateSize
                    options={FILTER_MATCH_OPTIONS}
                    size="xs"
                  />
                </EmbeddedWrapper>
              ),
            })}
          </StepLead>
          <DeleteButton
            aria-label={t('Delete If/Then Block')}
            size="sm"
            icon={<IconDelete />}
            borderless
            onClick={onDelete}
          />
        </Flex>
        <RuleNodeList placeholder={t('Filter by...')} groupId={`if_${id}`} />
      </Flex>
      <Flex column gap={space(1)}>
        <StepLead>
          {tct('[then:Then] perform these actions', {
            then: <Badge />,
          })}
        </StepLead>
        <RuleNodeList placeholder={t('Select an action...')} groupId={`if_${id}`} />
      </Flex>
    </IfThenWrapper>
  );
}

export default function AutomationForm() {
  const title = useDocumentTitle();
  const [ifThenBlocks, setIfThenBlocks] = useState<number[]>([0]);

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

  const handleAddBlock = () => {
    const newIndex = Math.max(...ifThenBlocks, -1) + 1;
    model.setValue(`if_${newIndex}.action_match`, 'any', {quiet: true});
    setIfThenBlocks(prev => [...prev, newIndex]);
  };

  const handleDeleteBlock = (id: number) => {
    const data = model.getData();
    Object.keys(data)
      .filter(key => key.startsWith(`if_${id}`))
      .forEach(key => {
        model.removeField(key);
      });
    setIfThenBlocks(prev => prev.filter(i => i !== id));
  };

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
          <Flex column gap={space(1)}>
            <StepLead>
              {tct('[when:When] [selector] of the following occur', {
                when: <Badge />,
                selector: (
                  <EmbeddedWrapper>
                    <EmbeddedSelectField
                      styles={{
                        control: (provided: any) => ({
                          ...provided,
                          minHeight: '21px',
                          height: '21px',
                        }),
                      }}
                      inline={false}
                      isSearchable={false}
                      isClearable={false}
                      name="when.action_match"
                      required
                      flexibleControlStateSize
                      options={TRIGGER_MATCH_OPTIONS}
                      size="xs"
                    />
                  </EmbeddedWrapper>
                ),
              })}
            </StepLead>
            <RuleNodeList placeholder={t('Select a trigger...')} groupId="when" />
          </Flex>
          {ifThenBlocks.map(i => (
            <IfThenBlock
              key={i}
              id={i}
              totalBlocks={ifThenBlocks.length}
              onDelete={() => handleDeleteBlock(i)}
            />
          ))}
          <span>
            <PurpleTextButton
              borderless
              icon={<IconAdd />}
              size={'xs'}
              onClick={handleAddBlock}
            >
              {t('If/Then Block')}
            </PurpleTextButton>
          </span>
          <span>
            <Button icon={<IconMail />}>{t('Send Test Notification')}</Button>
          </span>
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

const PurpleTextButton = styled(Button)`
  color: ${p => p.theme.purple300};
  font-weight: normal;
`;

const StepLead = styled(Flex)`
  align-items: center;
  gap: ${space(0.5)};
`;

const Badge = styled('span')`
  display: inline-block;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.5;
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
`;

const EmbeddedWrapper = styled('div')`
  width: 80px;
`;

const IfThenWrapper = styled(Flex)`
  flex-direction: column;
  gap: ${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
  padding-top: ${space(1)};
  margin-top: ${space(1)};
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
  opacity: 0;

  ${IfThenWrapper}:hover & {
    opacity: 1;
  }
`;
