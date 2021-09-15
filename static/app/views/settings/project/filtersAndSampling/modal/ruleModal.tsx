import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import MenuItem from 'app/components/menuItem';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark} from 'app/icons/iconCheckmark';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRules,
} from 'app/types/dynamicSampling';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import NumberField from 'app/views/settings/components/forms/numberField';

import Conditions from './conditions';
import handleXhrErrorResponse from './handleXhrErrorResponse';
import {isLegacyBrowser} from './utils';

type ConditionsProps = React.ComponentProps<typeof Conditions>['conditions'];

type State = {
  conditions: ConditionsProps;
  errors: {
    sampleRate?: string;
  };
  sampleRate: number | null;
};

type Props = ModalRenderProps & {
  title: string;
  emptyMessage: string;
  conditionCategories: Array<[DynamicSamplingInnerName, string]>;
  api: Client;
  organization: Organization;
  project: Project;
  onSubmitSuccess: (project: Project, successMessage: React.ReactNode) => void;
  onSubmit: (
    props: Omit<State, 'errors'> & {
      submitRules: (
        newRules: DynamicSamplingRules,
        currentRuleIndex: number
      ) => Promise<void>;
    }
  ) => void;
  onChange?: (props: State) => void;
  extraFields?: React.ReactElement;
  rule?: DynamicSamplingRule;
};

function RuleModal({
  Header,
  Body,
  Footer,
  closeModal,
  title,
  emptyMessage,
  conditionCategories,
  api,
  organization,
  project,
  onSubmitSuccess,
  onSubmit,
  onChange,
  extraFields,
  rule,
}: Props) {
  const [data, setData] = useState<State>(getInitialState());

  useEffect(() => {
    if (!!data.errors.sampleRate) {
      setData({...data, errors: {...data.errors, sampleRate: undefined}});
    }
  }, [data.sampleRate]);

  useEffect(() => {
    onChange?.(data);
  }, [data]);

  function getInitialState(): State {
    if (rule) {
      const {condition: conditions, sampleRate} = rule as DynamicSamplingRule;

      const {inner} = conditions;

      return {
        conditions: inner.map(({name, value}) => {
          if (Array.isArray(value)) {
            if (isLegacyBrowser(value)) {
              return {
                category: name,
                legacyBrowsers: value,
              };
            }
            return {
              category: name,
              match: value.join('\n'),
            };
          }
          return {category: name};
        }),
        sampleRate: sampleRate * 100,
        errors: {},
      };
    }

    return {
      conditions: [],
      sampleRate: null,
      errors: {},
    };
  }

  const {errors, conditions, sampleRate} = data;

  async function submitRules(newRules: DynamicSamplingRules, currentRuleIndex: number) {
    try {
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      onSubmitSuccess(
        newProjectDetails,
        rule
          ? t('Successfully edited dynamic sampling rule')
          : t('Successfully added dynamic sampling rule')
      );
      closeModal();
    } catch (error) {
      convertErrorXhrResponse(handleXhrErrorResponse(error, currentRuleIndex));
    }
  }

  function convertErrorXhrResponse(error: ReturnType<typeof handleXhrErrorResponse>) {
    switch (error.type) {
      case 'sampleRate':
        setData({...data, errors: {...errors, sampleRate: error.message}});
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  function handleAddCondition(category: DynamicSamplingInnerName) {
    setData({
      ...data,
      conditions: [
        ...conditions,
        {
          category,
          match: '',
        },
      ],
    });
  }

  function handleDeleteCondition(index: number) {
    const newConditions = [...conditions];
    newConditions.splice(index, 1);
    setData({...data, conditions: newConditions});
  }

  function handleChangeCondition<T extends keyof ConditionsProps[0]>(
    index: number,
    field: T,
    value: ConditionsProps[0][T]
  ) {
    const newConditions = [...conditions];
    newConditions[index][field] = value;
    setData({...data, conditions: newConditions});
  }

  const submitDisabled =
    !defined(sampleRate) ||
    !!conditions?.find(condition => {
      if (condition.category === DynamicSamplingInnerName.EVENT_LEGACY_BROWSER) {
        return !(condition.legacyBrowsers ?? []).length;
      }

      if (
        condition.category === DynamicSamplingInnerName.EVENT_LOCALHOST ||
        condition.category === DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS ||
        condition.category === DynamicSamplingInnerName.EVENT_WEB_CRAWLERS
      ) {
        return false;
      }

      return !condition.match;
    });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{title}</h4>
      </Header>
      <Body>
        <Fields>
          {extraFields}
          <StyledPanel>
            <StyledPanelHeader hasButtons>
              {t('Conditions')}
              <DropdownAutoComplete
                onSelect={item => {
                  handleAddCondition(item.value);
                }}
                alignMenu="right"
                items={conditionCategories.map(conditionCategory => {
                  const disabled = conditions.some(
                    condition => condition.category === conditionCategory[0]
                  );
                  return {
                    value: conditionCategory[0],
                    disabled,
                    label: (
                      <Tooltip
                        title={t('This condition has already been added')}
                        disabled={!disabled}
                      >
                        <StyledMenuItem disabled={disabled}>
                          {conditionCategory[1]}
                        </StyledMenuItem>
                      </Tooltip>
                    ),
                  };
                })}
              >
                {({isOpen}) => (
                  <DropdownButton isOpen={isOpen} size="small">
                    {t('Add Condition')}
                  </DropdownButton>
                )}
              </DropdownAutoComplete>
            </StyledPanelHeader>
            <PanelBody>
              {!conditions.length ? (
                <EmptyMessage icon={<IconCheckmark isCircled size="xl" />}>
                  {emptyMessage}
                </EmptyMessage>
              ) : (
                <Conditions
                  conditions={conditions}
                  onDelete={handleDeleteCondition}
                  onChange={handleChangeCondition}
                />
              )}
            </PanelBody>
          </StyledPanel>
          <NumberField
            label={`${t('Sampling Rate')} \u0025`}
            name="sampleRate"
            onChange={value => {
              setData({...data, sampleRate: !!value ? Number(value) : null});
            }}
            placeholder={'\u0025'}
            value={sampleRate}
            inline={false}
            hideControlState={!errors.sampleRate}
            error={errors.sampleRate}
            showHelpInTooltip
            stacked
            required
          />
        </Fields>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={() => onSubmit({conditions, sampleRate, submitRules})}
            disabled={submitDisabled}
          >
            {t('Save Rule')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default RuleModal;

const Fields = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
`;

const StyledMenuItem = styled(MenuItem)`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  text-transform: none;
  span {
    padding: 0;
  }
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-right: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;
