import {Fragment, useEffect, useState} from 'react';
import {components, createFilter} from 'react-select';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CompactSelect from 'sentry/components/forms/compactSelect';
import NumberField from 'sentry/components/forms/numberField';
import Option from 'sentry/components/forms/selectOption';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd} from 'sentry/icons';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, SelectValue} from 'sentry/types';
import {
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRules,
} from 'sentry/types/dynamicSampling';
import {defined} from 'sentry/utils';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import Conditions from './conditions';
import {getErrorMessage, isInnerCustomTag, isLegacyBrowser} from './utils';

type ConditionsProps = React.ComponentProps<typeof Conditions>['conditions'];

type State = {
  conditions: ConditionsProps;
  errors: {
    sampleRate?: string;
  };
  sampleRate: number | null;
};

type Props = ModalRenderProps & {
  api: Client;
  conditionCategories: Array<[DynamicSamplingInnerName, string]>;
  emptyMessage: string;
  onSubmit: (
    props: Omit<State, 'errors'> & {
      submitRules: (
        newRules: DynamicSamplingRules,
        currentRuleIndex: number
      ) => Promise<void>;
    }
  ) => void;
  onSubmitSuccess: (project: Project, successMessage: React.ReactNode) => void;
  organization: Organization;
  project: Project;
  title: string;
  extraFields?: React.ReactElement;
  onChange?: (props: State) => void;
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
    setData(d => {
      if (!!d.errors.sampleRate) {
        return {...d, errors: {...d.errors, sampleRate: undefined}};
      }

      return d;
    });
  }, [data.sampleRate]);

  useEffect(() => {
    onChange?.(data);
  }, [data, onChange]);

  function getInitialState(): State {
    if (rule) {
      const {condition: conditions, sampleRate} = rule as DynamicSamplingRule;

      const {inner} = conditions;

      return {
        conditions: inner.map(innerItem => {
          const {name, value} = innerItem;

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
              ...(isInnerCustomTag(innerItem) && {tagKey: innerItem.tagKey ?? ''}),
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
      convertRequestErrorResponse(getErrorMessage(error, currentRuleIndex));
    }
  }

  function convertRequestErrorResponse(error: ReturnType<typeof getErrorMessage>) {
    if (typeof error === 'string') {
      addErrorMessage(error);
      return;
    }

    switch (error.type) {
      case 'sampleRate':
        setData({...data, errors: {...errors, sampleRate: error.message}});
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  function handleAddCondition(selectedOptions: SelectValue<DynamicSamplingInnerName>[]) {
    const previousCategories = conditions.map(({category}) => category);
    const addedCategories = selectedOptions
      .filter(
        ({value}) =>
          value === DynamicSamplingInnerName.EVENT_CUSTOM_TAG || // We can have more than 1 custom tag rules
          !previousCategories.includes(value)
      )
      .map(({value}) => value);
    setData({
      ...data,
      conditions: [
        ...conditions,
        ...addedCategories.map(addedCategory => ({category: addedCategory, match: ''})),
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

    // If custom tag key changes, reset the value
    if (field === 'tagKey') {
      newConditions[index].match = '';
    }

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
              <StyledCompactSelect
                placement="bottom right"
                triggerLabel={t('Add Condition')}
                placeholder={t('Filter conditions')}
                isOptionDisabled={opt => opt.disabled}
                options={conditionCategories.map(([value, label]) => {
                  // Never disable the "Add Custom Tag" option, you can add more of those
                  const disabled =
                    value === DynamicSamplingInnerName.EVENT_CUSTOM_TAG
                      ? false
                      : conditions.some(condition => condition.category === value);
                  return {
                    value,
                    label,
                    disabled,
                    tooltip: disabled
                      ? t('This condition has already been added')
                      : undefined,
                  };
                })}
                value={conditions
                  // We need to filter our custom tag option so that it can be selected multiple times without being unselected every other time
                  .filter(
                    ({category}) => category !== DynamicSamplingInnerName.EVENT_CUSTOM_TAG
                  )
                  .map(({category}) => category)}
                onChange={handleAddCondition}
                isSearchable
                multiple
                filterOption={(candidate, input) => {
                  // Always offer the "Add Custom Tag" option in the autocomplete
                  if (candidate.value === DynamicSamplingInnerName.EVENT_CUSTOM_TAG) {
                    return true;
                  }
                  return createFilter(null)(candidate, input);
                }}
                components={{
                  Option: containerProps => {
                    if (
                      containerProps.value === DynamicSamplingInnerName.EVENT_CUSTOM_TAG
                    ) {
                      return (
                        <components.Option className="select-option" {...containerProps}>
                          <AddCustomTag isFocused={containerProps.isFocused}>
                            <IconAdd isCircled /> {t('Add Custom Tag')}
                          </AddCustomTag>
                        </components.Option>
                      );
                    }
                    return <Option {...containerProps} />;
                  },
                }}
              />
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
                  orgSlug={organization.slug}
                  projectId={project.id}
                  projectSlug={project.slug}
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
            title={submitDisabled ? t('Required fields must be filled out') : undefined}
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
  gap: ${space(2)};
`;

const StyledCompactSelect = styled(CompactSelect)`
  font-weight: 400;
  text-transform: none;
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-right: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const AddCustomTag = styled('div')<{isFocused: boolean}>`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(1.5)};
  gap: ${space(1)};
  line-height: 1.4;
  border-radius: ${p => p.theme.borderRadius};
  ${p => p.isFocused && `background: ${p.theme.hover};`};
`;
