import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import SelectField from 'sentry/components/forms/fields/selectField';
import {IconAdd, IconDelete, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FILTER_MATCH_OPTIONS} from 'sentry/views/automations/components/actionFilters/constants';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import RuleNodeList from 'sentry/views/automations/components/ruleNodeList';
import {TRIGGER_MATCH_OPTIONS} from 'sentry/views/automations/components/triggers/constants';

export default function AutomationBuilder() {
  const {state, dispatch} = useAutomationBuilderContext();

  return (
    <Flex column gap={space(1)}>
      <Step>
        <StepLead>
          {/* TODO: Only make this a selector of "all" is originally selected */}
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
                  name="triggers.logicType"
                  value={state.triggers.logicType}
                  onChange={value =>
                    dispatch({type: 'UPDATE_WHEN_LOGIC_TYPE', logicType: value})
                  }
                  required
                  flexibleControlStateSize
                  options={TRIGGER_MATCH_OPTIONS}
                  size="xs"
                />
              </EmbeddedWrapper>
            ),
          })}
        </StepLead>
      </Step>
      <RuleNodeList
        placeholder={t('Select a trigger...')}
        conditions={state.triggers.conditions}
        group="triggers"
        onAddRow={type => dispatch({type: 'ADD_WHEN_CONDITION', conditionType: type})}
        onDeleteRow={index => dispatch({type: 'REMOVE_WHEN_CONDITION', index})}
        updateCondition={(index, comparison) =>
          dispatch({type: 'UPDATE_CONDITION', index, comparison})
        }
      />

      {state.actionFilters.map((_, index) => (
        <ActionFilterBlock key={index} id={index} />
      ))}
      <span>
        <PurpleTextButton
          borderless
          icon={<IconAdd />}
          size="xs"
          onClick={() => dispatch({type: 'ADD_IF'})}
        >
          {t('If/Then Block')}
        </PurpleTextButton>
      </span>
      <span>
        <Button icon={<IconMail />}>{t('Send Test Notification')}</Button>
      </span>
    </Flex>
  );
}

interface ActionFilterBlockProps {
  id: number;
}

function ActionFilterBlock({id}: ActionFilterBlockProps) {
  const {state, dispatch} = useAutomationBuilderContext();
  const actionFilterBlock = state.actionFilters[id];

  return (
    <IfThenWrapper key={id}>
      <Step>
        <Flex column gap={space(0.75)}>
          <Flex justify="space-between">
            <StepLead>
              {tct('[if: If] [selector] of these filters match', {
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
                      name={`actionFilters.${id}.logicType`}
                      required
                      flexibleControlStateSize
                      options={FILTER_MATCH_OPTIONS}
                      size="xs"
                      value={actionFilterBlock?.logicType}
                      onChange={value =>
                        dispatch({
                          type: 'UPDATE_IF_LOGIC_TYPE',
                          groupIndex: id,
                          logicType: value,
                        })
                      }
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
              onClick={() =>
                dispatch({
                  type: 'REMOVE_IF',
                  groupIndex: id,
                })
              }
            />
          </Flex>
          <RuleNodeList
            placeholder={t('Filter by...')}
            group={`actionFilters.${id}`}
            conditions={actionFilterBlock?.conditions || []}
            onAddRow={type =>
              dispatch({type: 'ADD_IF_CONDITION', groupIndex: id, conditionType: type})
            }
            onDeleteRow={index =>
              dispatch({
                type: 'REMOVE_IF_CONDITION',
                groupIndex: id,
                conditionIndex: index,
              })
            }
            updateCondition={(index, comparison) =>
              dispatch({
                type: 'UPDATE_IF_CONDITION',
                groupIndex: id,
                conditionIndex: index,
                comparison,
              })
            }
          />
        </Flex>
      </Step>
      <Step>
        <StepLead>
          {tct('[then:Then] perform these actions', {
            then: <Badge />,
          })}
        </StepLead>
        {/* TODO: add actions dropdown here */}
      </Step>
    </IfThenWrapper>
  );
}

const PurpleTextButton = styled(Button)`
  color: ${p => p.theme.purple300};
  font-weight: normal;
  padding: 0;
`;

const Step = styled(Flex)`
  flex-direction: column;
  gap: ${space(0.75)};
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
  gap: ${space(1.5)};
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
