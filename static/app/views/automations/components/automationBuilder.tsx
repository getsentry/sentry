import {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import SelectField from 'sentry/components/forms/fields/selectField';
import type FormModel from 'sentry/components/forms/model';
import {IconAdd, IconDelete, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import RuleNodeList from 'sentry/views/automations/components/ruleNodeList';

const TRIGGER_MATCH_OPTIONS = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
];

const FILTER_MATCH_OPTIONS = [
  {value: 'all', label: t('all')},
  {value: 'any', label: t('any')},
  {value: 'none', label: t('none')},
];

function IfThenBlock({id, onDelete}: {id: number; onDelete: () => void}) {
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
                    name={`if[${id}].action_match`}
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
        <RuleNodeList placeholder={t('Filter by...')} group={`if[${id}]`} />
      </Flex>
      <Flex column gap={space(1)}>
        <StepLead>
          {tct('[then:Then] perform these actions', {
            then: <Badge />,
          })}
        </StepLead>
        <RuleNodeList placeholder={t('Select an action...')} group={`if[${id}]`} />
      </Flex>
    </IfThenWrapper>
  );
}

export default function AutomationBuilder({model}: {model: FormModel}) {
  const [ifThenBlocks, setIfThenBlocks] = useState<number[]>([0]);

  const handleAddBlock = () => {
    const newIndex = Math.max(...ifThenBlocks, -1) + 1;
    model.setValue(`if[${newIndex}].action_match`, 'any', {quiet: true});
    setIfThenBlocks(prev => [...prev, newIndex]);
  };

  const handleDeleteBlock = (id: number) => {
    const data = model.getData();
    Object.keys(data)
      .filter(key => key.startsWith(`if[${id}]`))
      .forEach(key => {
        model.removeField(key);
      });
    setIfThenBlocks(prev => prev.filter(i => i !== id));
  };

  return (
    <div>
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
        <RuleNodeList placeholder={t('Select a trigger...')} group="when" />

        {ifThenBlocks.map(i => (
          <IfThenBlock key={i} id={i} onDelete={() => handleDeleteBlock(i)} />
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
      </Flex>
    </div>
  );
}

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
