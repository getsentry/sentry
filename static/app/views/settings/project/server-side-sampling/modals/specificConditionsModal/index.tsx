import {Fragment, KeyboardEvent, useEffect, useState} from 'react';
import {createFilter} from 'react-select';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CompactSelect from 'sentry/components/forms/compactSelect';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import NumberField from 'sentry/components/forms/numberField';
import Option from 'sentry/components/forms/selectOption';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project, SelectValue} from 'sentry/types';
import {
  SamplingConditionOperator,
  SamplingInnerName,
  SamplingRule,
  SamplingRules,
  SamplingRuleType,
} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {Condition, Conditions} from './conditions';
import {
  distributedTracesConditions,
  generateConditionCategoriesOptions,
  getErrorMessage,
  getNewCondition,
} from './utils';

const conditionAlreadyAddedTooltip = t('This condition has already been added');

type State = {
  conditions: Condition[];
  errors: {
    sampleRate?: string;
  };
  sampleRate: number | null;
};

type Props = ModalRenderProps & {
  organization: Organization;
  project: Project;
  rules: SamplingRules;
  rule?: SamplingRule;
};

export function SpecificConditionsModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  rule,
  rules,
  organization,
}: Props) {
  const api = useApi();

  const [data, setData] = useState<State>(getInitialState());
  const [isSaving, setIsSaving] = useState(false);

  const conditionCategories = generateConditionCategoriesOptions(
    distributedTracesConditions
  );

  useEffect(() => {
    setData(d => {
      if (!!d.errors.sampleRate) {
        return {...d, errors: {...d.errors, sampleRate: undefined}};
      }

      return d;
    });
  }, [data.sampleRate]);

  function getInitialState(): State {
    if (rule) {
      const {condition: conditions, sampleRate} = rule;

      const {inner} = conditions;

      return {
        conditions: inner.map(innerItem => {
          const {name, value} = innerItem;

          if (Array.isArray(value)) {
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

  async function handleSubmit() {
    if (!defined(sampleRate)) {
      return;
    }

    const newRule: SamplingRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
      active: rule ? rule.active : false,
      type: SamplingRuleType.TRACE,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: !conditions.length ? [] : conditions.map(getNewCondition),
      },
      sampleRate: sampleRate / 100,
    };

    const newRules = rule
      ? rules.map(existingRule => (existingRule.id === rule.id ? newRule : existingRule))
      : [...rules, newRule];

    const currentRuleIndex = newRules.findIndex(newR => newR === newRule);

    setIsSaving(true);

    try {
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      ProjectStore.onUpdateSuccess(newProjectDetails);
      addSuccessMessage(
        rule
          ? t('Successfully edited sampling rule')
          : t('Successfully added sampling rule')
      );
      closeModal();
    } catch (error) {
      convertRequestErrorResponse(getErrorMessage(error, currentRuleIndex));
    }

    setIsSaving(false);

    const analyticsConditions = conditions.map(condition => condition.category);
    const analyticsConditionsStringified = analyticsConditions.sort().join(', ');

    trackAdvancedAnalyticsEvent('sampling.settings.rule.save', {
      organization,
      project_id: project.id,
      sampling_rate: sampleRate,
      conditions: analyticsConditions,
      conditions_stringified: analyticsConditionsStringified,
    });

    if (defined(rule)) {
      trackAdvancedAnalyticsEvent('sampling.settings.rule.update', {
        organization,
        project_id: project.id,
        sampling_rate: sampleRate,
        conditions: analyticsConditions,
        conditions_stringified: analyticsConditionsStringified,
        old_conditions: rule.condition.inner.map(({name}) => name),
        old_conditions_stringified: rule.condition.inner
          .map(({name}) => name)
          .sort()
          .join(', '),
        old_sampling_rate: rule.sampleRate * 100,
      });
      return;
    }

    trackAdvancedAnalyticsEvent('sampling.settings.rule.create', {
      organization,
      project_id: project.id,
      sampling_rate: sampleRate,
      conditions: analyticsConditions,
      conditions_stringified: analyticsConditionsStringified,
    });
  }

  function handleAddCondition(selectedOptions: SelectValue<SamplingInnerName>[]) {
    const previousCategories = conditions.map(({category}) => category);
    const addedCategories = selectedOptions
      .filter(({value}) => !previousCategories.includes(value))
      .map(({value}) => value);

    trackAdvancedAnalyticsEvent('sampling.settings.condition.add', {
      organization,
      project_id: project.id,
      conditions: addedCategories,
    });

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

  function handleChangeCondition<T extends keyof Condition>(
    index: number,
    field: T,
    value: Condition[T]
  ) {
    const newConditions = [...conditions];
    newConditions[index][field] = value;

    // If custom tag key changes, reset the value
    if (field === 'category') {
      newConditions[index].match = '';

      trackAdvancedAnalyticsEvent('sampling.settings.condition.add', {
        organization,
        project_id: project.id,
        conditions: [value as SamplingInnerName],
      });
    }

    setData({...data, conditions: newConditions});
  }

  const predefinedConditionsOptions = conditionCategories.map(([value, label]) => {
    const optionDisabled = conditions.some(condition => condition.category === value);
    return {
      value,
      label,
      disabled: optionDisabled,
      tooltip: optionDisabled ? conditionAlreadyAddedTooltip : undefined,
    };
  });

  const submitDisabled =
    !defined(sampleRate) ||
    !conditions.length ||
    conditions.some(condition => !condition.match);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{rule ? t('Edit Rule') : t('Add Rule')}</h4>
      </Header>
      <Body>
        <Fields>
          <Description>
            {t(
              'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions.'
            )}
          </Description>
          <StyledPanel>
            <StyledPanelHeader hasButtons>
              <div>
                {t('Conditions')}
                <FieldRequiredBadge />
              </div>
              <StyledCompactSelect
                placement="bottom right"
                triggerProps={{
                  size: 'small',
                  'aria-label': t('Add Condition'),
                }}
                triggerLabel={
                  <TriggerLabel>
                    <IconAdd isCircled />
                    {t('Add Condition')}
                  </TriggerLabel>
                }
                placeholder={t('Filter conditions')}
                isOptionDisabled={opt => opt.disabled}
                options={predefinedConditionsOptions}
                value={conditions.map(({category}) => category)}
                onChange={handleAddCondition}
                isSearchable
                multiple
                filterOption={(candidate, input) => createFilter(null)(candidate, input)}
                components={{
                  Option: containerProps => <Option {...containerProps} />,
                }}
              />
            </StyledPanelHeader>
            <PanelBody>
              {!conditions.length ? (
                <EmptyMessage
                  icon={<IconSearch size="xl" />}
                  title={t('No conditions added')}
                  description={t('Click on the button above to add (+) a condition')}
                />
              ) : (
                <Conditions
                  conditions={conditions}
                  onDelete={handleDeleteCondition}
                  onChange={handleChangeCondition}
                  orgSlug={organization.slug}
                  projectId={project.id}
                />
              )}
            </PanelBody>
          </StyledPanel>
          <NumberField
            label={`${t('Sample Rate')} \u0025`}
            name="sampleRate"
            onChange={value => {
              setData({...data, sampleRate: !!value ? Number(value) : null});
            }}
            onKeyDown={(_value: string, e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
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
            onClick={handleSubmit}
            title={submitDisabled ? t('Required fields must be filled out') : undefined}
            disabled={isSaving || submitDisabled}
          >
            {t('Save Rule')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

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

const TriggerLabel = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${space(1)};
`;

const Description = styled(TextBlock)`
  margin: 0;
`;
