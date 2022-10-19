import {Fragment, KeyboardEvent, useState} from 'react';
import {createFilter} from 'react-select';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CompactSelect from 'sentry/components/compactSelect';
import EmptyMessage from 'sentry/components/emptyMessage';
import Option from 'sentry/components/forms/controls/selectOption';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import NumberField from 'sentry/components/forms/fields/numberField';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project, SelectValue} from 'sentry/types';
import {
  SamplingConditionOperator,
  SamplingInnerName,
  SamplingRule,
  SamplingRuleType,
} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {
  isUniformRule,
  isValidSampleRate,
  percentageToRate,
  rateToPercentage,
} from '../../utils';

import {Condition, Conditions} from './conditions';
import {
  distributedTracesConditions,
  generateConditionCategoriesOptions,
  getNewCondition,
} from './utils';

const conditionAlreadyAddedTooltip = t('This condition has already been added');

type Props = ModalRenderProps & {
  organization: Organization;
  project: Project;
  rules: SamplingRule[];
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
  CloseButton,
}: Props) {
  const api = useApi();

  const [conditions, setConditions] = useState<Condition[]>(() => {
    if (rule) {
      return rule.condition.inner.map(innerItem => {
        const {name, value} = innerItem;

        if (Array.isArray(value)) {
          return {
            category: name,
            match: value.join('\n'),
          };
        }
        return {category: name};
      });
    }

    return [];
  });

  const [samplePercentage, setSamplePercentage] = useState<number | undefined>(
    rateToPercentage(rule?.sampleRate)
  );

  const [isSaving, setIsSaving] = useState(false);

  const uniformRuleSampleRate = rules.find(isUniformRule)?.sampleRate;

  const validSampleRate = isValidSampleRate(
    uniformRuleSampleRate,
    percentageToRate(samplePercentage)
  );

  const conditionCategories = generateConditionCategoriesOptions(
    distributedTracesConditions
  );

  async function handleSubmit() {
    if (!validSampleRate) {
      return;
    }
    const sampleRate = percentageToRate(samplePercentage)!;

    const newRule: SamplingRule = {
      // All new rules must have the default id set to -1, signaling to the backend that a proper id should
      // be assigned.
      id: -1,
      active: rule ? rule.active : false,
      type: SamplingRuleType.TRACE,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: !conditions.length ? [] : conditions.map(getNewCondition),
      },
      sampleRate,
    };

    const newRules = rule
      ? rules.map(existingRule => (existingRule.id === rule.id ? newRule : existingRule))
      : [...rules, newRule];

    // Make sure that a uniform rule is always send in the last position of the rules array
    const [uniformRule, specificRules] = partition(newRules, isUniformRule);

    setIsSaving(true);

    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {dynamicSampling: {rules: [...specificRules, ...uniformRule]}},
        }
      );
      ProjectsStore.onUpdateSuccess(response);
      addSuccessMessage(
        rule
          ? t('Successfully edited sampling rule')
          : t('Successfully added sampling rule')
      );
      closeModal();
    } catch (error) {
      const message = t('Unable to save conditional sampling rule');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }

    setIsSaving(false);

    const analyticsConditions = conditions.map(condition => condition.category);
    const analyticsConditionsStringified = analyticsConditions.sort().join(', ');

    trackAdvancedAnalyticsEvent('sampling.settings.rule.specific_save', {
      organization,
      project_id: project.id,
      sampling_rate: sampleRate,
      conditions: analyticsConditions,
      conditions_stringified: analyticsConditionsStringified,
    });

    if (defined(rule)) {
      trackAdvancedAnalyticsEvent('sampling.settings.rule.specific_update', {
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
        old_sampling_rate: rule.sampleRate,
      });
      return;
    }

    trackAdvancedAnalyticsEvent('sampling.settings.rule.specific_create', {
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

    trackAdvancedAnalyticsEvent('sampling.settings.modal.specific.rule.condition_add', {
      organization,
      project_id: project.id,
      conditions: addedCategories,
    });

    setConditions([
      ...conditions,
      ...addedCategories.map(addedCategory => ({category: addedCategory, match: ''})),
    ]);
  }

  function handleDeleteCondition(index: number) {
    const newConditions = [...conditions];
    newConditions.splice(index, 1);
    setConditions(newConditions);
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

      trackAdvancedAnalyticsEvent('sampling.settings.modal.specific.rule.condition_add', {
        organization,
        project_id: project.id,
        conditions: [value as SamplingInnerName],
      });
    }

    setConditions(newConditions);
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

  const sampleRateEdited = rule
    ? samplePercentage !== rateToPercentage(rule?.sampleRate)
    : samplePercentage !== undefined;

  const submitDisabled =
    !validSampleRate ||
    !conditions.length ||
    conditions.some(condition => !condition.match);

  return (
    <Fragment>
      <CloseButton />
      <Feature
        features={['server-side-sampling', 'server-side-sampling-ui']}
        organization={organization}
        hookName="feature-disabled:dynamic-sampling-advanced"
      >
        <Header>
          <h4>{rule ? t('Edit Rule') : t('Add Rule')}</h4>
        </Header>
        <Body>
          <Fields>
            <Description>
              {t(
                'Sample transactions under specific conditions. Multiple conditions are logically expressed as AND and OR for multiple values.'
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
                    size: 'sm',
                    'aria-label': t('Add Condition'),
                  }}
                  triggerLabel={
                    <TriggerLabel>
                      <IconAdd isCircled />
                      {t('Add Condition')}
                    </TriggerLabel>
                  }
                  placeholder={t('Filter conditions')}
                  isDisabled={isUniformRule(rule)}
                  options={predefinedConditionsOptions}
                  value={conditions.map(({category}) => category)}
                  onChange={handleAddCondition}
                  isSearchable
                  multiple
                  filterOption={(candidate, input) =>
                    createFilter(null)(candidate, input)
                  }
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
                setSamplePercentage(value ? Number(value) : undefined);
              }}
              onKeyDown={(_value: string, e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
              placeholder={'\u0025'}
              step="10"
              value={samplePercentage ?? null}
              flexibleControlStateSize
              inline={false}
              error={
                (sampleRateEdited && !validSampleRate) || (rule && !validSampleRate)
                  ? tct('Sample rate shall be betweeen [floorRate]% and 100%', {
                      floorRate: rateToPercentage(uniformRuleSampleRate),
                    })
                  : undefined
              }
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
              title={
                submitDisabled
                  ? t('Required fields must be filled out with valid values')
                  : undefined
              }
              disabled={isSaving || submitDisabled}
            >
              {t('Save Rule')}
            </Button>
          </ButtonBar>
        </Footer>
      </Feature>
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
