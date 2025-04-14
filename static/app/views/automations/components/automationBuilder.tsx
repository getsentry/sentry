import {useContext} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import SelectField from 'sentry/components/forms/fields/selectField';
import {IconAdd, IconDelete, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AutomationBuilderContext} from 'sentry/views/automations/components/automationForm';
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
interface IfThenBlockProps {
  addIfCondition: (
    groupIndex: number,
    type: string,
    field: 'conditions' | 'actions'
  ) => void;
  id: number;
  onDelete: () => void;
  removeIfCondition: (
    groupIndex: number,
    conditionIndex: number,
    field: 'conditions' | 'actions'
  ) => void;
  updateIfCondition: (
    groupIndex: number,
    conditionIndex: number,
    comparison: any,
    field: 'conditions' | 'actions'
  ) => void;
  updateIfGroupLogicType: (groupIndex: number, logic_type: 'any' | 'all') => void;
}

function IfThenBlock({
  id,
  onDelete,
  addIfCondition,
  removeIfCondition,
  updateIfCondition,
  updateIfGroupLogicType,
}: IfThenBlockProps) {
  const ctx = useContext(AutomationBuilderContext);
  if (!ctx) {
    throw new Error('stop what ur doin');
  }
  const {state} = ctx;
  const ifBlock = state.if[id];

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
                    name={`if.${id}.logic_type`}
                    required
                    flexibleControlStateSize
                    options={FILTER_MATCH_OPTIONS}
                    size="xs"
                    value={ifBlock?.logic_type}
                    onChange={value => updateIfGroupLogicType(id, value)}
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
        <RuleNodeList
          placeholder={t('Filter by...')}
          group={`if.${id}`}
          conditions={ifBlock?.conditions || []}
          onAddRow={type => addIfCondition(id, type, 'conditions')}
          onDeleteRow={index => removeIfCondition(id, index, 'conditions')}
          updateCondition={(index, comparison) =>
            updateIfCondition(id, index, comparison, 'conditions')
          }
        />
      </Flex>
      <Flex column gap={space(1)}>
        <StepLead>
          {tct('[then:Then] perform these actions', {
            then: <Badge />,
          })}
        </StepLead>
        <RuleNodeList
          placeholder={t('Select an action...')}
          group={`if.${id}.then`}
          conditions={ifBlock?.actions || []}
          onAddRow={type => addIfCondition(id, type, 'actions')}
          onDeleteRow={index => removeIfCondition(id, index, 'actions')}
          updateCondition={(index, comparison) =>
            updateIfCondition(id, index, comparison, 'actions')
          }
        />
      </Flex>
    </IfThenWrapper>
  );
}

export default function AutomationBuilder() {
  const ctx = useContext(AutomationBuilderContext);
  if (!ctx) {
    throw new Error('stop what ur doin');
  }
  const {state, setState} = ctx;
  function addCondition(type: string) {
    setState(s => {
      return {
        when: {
          ...s.when,
          conditions: [
            ...s.when.conditions,
            {
              type,
              comparison: {
                operator: 'eq',
                value: 0,
              },
            },
          ],
        },
        if: s.if.map(group => ({
          ...group,
        })),
      };
    });
  }
  function removeCondition(index: number) {
    setState(s => {
      const newState = {
        ...s,
        when: {
          ...s.when,
          conditions: [...s.when.conditions.filter((_, i) => index !== i)],
        },
      };
      return newState;
    });
  }
  function updateCondition(index: number, comparison: any) {
    setState(s => ({
      when: {
        ...s.when,
        conditions: s.when.conditions.map((c, i) =>
          i === index ? {...c, comparison: {...c.comparison, ...comparison}} : c
        ),
      },
      if: s.if.map(group => ({
        ...group,
      })),
    }));
  }

  function addIfGroup() {
    setState(s => ({
      ...s,
      if: [
        ...s.if,
        {
          conditions: [],
          actions: [],
          logic_type: 'any',
        },
      ],
    }));
  }

  function removeIfGroup(groupIndex: number) {
    setState(s => ({
      ...s,
      if: s.if.filter((_, i) => i !== groupIndex),
    }));
  }

  function addIfCondition(
    groupIndex: number,
    type: string,
    field: 'conditions' | 'actions'
  ) {
    setState(s => ({
      ...s,
      if: s.if.map((group, i) => {
        if (i !== groupIndex) {
          return group;
        }
        return {
          ...group,
          logic_type: 'any',
          [field]: [
            ...(group[field] || []),
            {
              type,
              comparison: {},
            },
          ],
        };
      }),
    }));
  }

  function removeIfCondition(
    groupIndex: number,
    conditionIndex: number,
    field: 'conditions' | 'actions'
  ) {
    setState(s => ({
      ...s,
      if: s.if.map((group, i) => {
        if (i !== groupIndex) {
          return group;
        }
        return {
          ...group,
          [field]: (group[field] || []).filter((_, j) => j !== conditionIndex),
        };
      }),
    }));
  }

  function updateIfCondition(
    groupIndex: number,
    conditionIndex: number,
    comparison: any,
    field: 'conditions' | 'actions'
  ) {
    setState(s => ({
      ...s,
      if: s.if.map((group, i) => {
        if (i !== groupIndex) {
          return group;
        }
        return {
          ...group,
          [field]: (group[field] || []).map((c, j) =>
            j === conditionIndex
              ? {...c, comparison: {...c.comparison, ...comparison}}
              : c
          ),
        };
      }),
    }));
  }

  function updateIfGroupLogicType(groupIndex: number, logic_type: 'any' | 'all') {
    setState(s => ({
      ...s,
      if: s.if.map((group, i) => {
        if (i !== groupIndex) {
          return group;
        }
        return {
          ...group,
          logic_type,
        };
      }),
    }));
  }

  return (
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
                name="when.logic_type"
                required
                flexibleControlStateSize
                options={TRIGGER_MATCH_OPTIONS}
                size="xs"
              />
            </EmbeddedWrapper>
          ),
        })}
      </StepLead>
      <RuleNodeList
        placeholder={t('Select a trigger...')}
        conditions={state.when.conditions}
        group="when"
        onAddRow={addCondition}
        onDeleteRow={removeCondition}
        updateCondition={updateCondition}
      />

      {state.if.map((_, index) => (
        <IfThenBlock
          key={index}
          id={index}
          onDelete={() => removeIfGroup(index)}
          addIfCondition={addIfCondition}
          removeIfCondition={removeIfCondition}
          updateIfCondition={updateIfCondition}
          updateIfGroupLogicType={updateIfGroupLogicType}
        />
      ))}
      <span>
        <PurpleTextButton borderless icon={<IconAdd />} size="xs" onClick={addIfGroup}>
          {t('If/Then Block')}
        </PurpleTextButton>
      </span>
      <span>
        <Button icon={<IconMail />}>{t('Send Test Notification')}</Button>
      </span>
    </Flex>
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
