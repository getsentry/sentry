import {Fragment, KeyboardEvent, useEffect, useState} from 'react';
import {components, createFilter} from 'react-select';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CompactSelect from 'sentry/components/forms/compactSelect';
import NumberField from 'sentry/components/forms/numberField';
import Option from 'sentry/components/forms/selectOption';
import Link from 'sentry/components/links/link';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import Truncate from 'sentry/components/truncate';
import {IconAdd} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
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
import recreateRoute from 'sentry/utils/recreateRoute';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {getInnerNameLabel, isCustomTagName} from '../utils';

import Conditions from './conditions';
import {
  distributedTracesConditions,
  generateConditionCategoriesOptions,
  getErrorMessage,
  getNewCondition,
  individualTransactionsConditions,
  isLegacyBrowser,
} from './utils';

const conditionAlreadyAddedTooltip = t('This condition has already been added');

type ConditionsProps = React.ComponentProps<typeof Conditions>['conditions'];

type State = {
  conditions: ConditionsProps;
  errors: {
    sampleRate?: string;
  };
  sampleRate: number | null;
};

type Props = ModalRenderProps & {
  disabled: boolean;
  onSubmitSuccess: (project: Project, successMessage: React.ReactNode) => void;
  organization: Organization;
  project: Project;
  rules: SamplingRules;
  type: SamplingRuleType;
  rule?: SamplingRule;
};

export function SamplingRuleModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  onSubmitSuccess,
  rule,
  rules,
  disabled,
  type,
  organization,
}: Props) {
  const api = useApi();
  const params = useParams();
  const location = useLocation();
  const routes = useRoutes();

  const [data, setData] = useState<State>(getInitialState());
  const [isSaving, setIsSaving] = useState(false);

  const conditionCategories = generateConditionCategoriesOptions(
    type === SamplingRuleType.TRACE
      ? distributedTracesConditions
      : individualTransactionsConditions
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

  function getDescription() {
    if (type === SamplingRuleType.TRACE) {
      return {
        title: rule ? t('Edit Distributed Trace Rule') : t('Add Distributed Trace Rule'),
        description: tct(
          'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions. However, if you only want to select Transactions from within this project, we recommend you add a [link] rule instead.',
          {
            link: (
              <Link
                to={recreateRoute(`${SamplingRuleType.TRANSACTION}/`, {
                  routes,
                  location,
                  params,
                  stepBack: -1,
                })}
              >
                {t('Individual Transaction')}
              </Link>
            ),
          }
        ),
      };
    }

    return {
      title: rule
        ? t('Edit Individual Transaction Rule')
        : t('Add Individual Transaction Rule'),
      description: tct(
        'Select Transactions only within this project which match your conditions. However, If you want to select all Transactions distributed across multiple projects/services, we recommend you add a [link] rule instead.',
        {
          link: (
            <Link
              to={recreateRoute(`${SamplingRuleType.TRACE}/`, {
                routes,
                location,
                params,
                stepBack: -1,
              })}
            >
              {t('Distributed Trace')}
            </Link>
          ),
        }
      ),
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
      type,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: !conditions.length ? [] : conditions.map(getNewCondition),
      },
      sampleRate: sampleRate / 100,
    };

    const newTransactionRules = rule
      ? rules.map(r => (isEqual(r, rule) ? newRule : r))
      : [...rules, newRule];

    const [transactionTraceRules, individualTransactionRules] = partition(
      newTransactionRules,
      transactionRule => transactionRule.type === SamplingRuleType.TRACE
    );

    const newRules = [...transactionTraceRules, ...individualTransactionRules];

    const currentRuleIndex = newRules.findIndex(newR => newR === newRule);

    setIsSaving(true);

    try {
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      onSubmitSuccess(
        newProjectDetails,
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
      .filter(
        ({value}) =>
          value === SamplingInnerName.EVENT_CUSTOM_TAG || // We can have more than 1 custom tag rules
          !previousCategories.includes(value)
      )
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

  function handleChangeCondition<T extends keyof ConditionsProps[0]>(
    index: number,
    field: T,
    value: ConditionsProps[0][T]
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

  // Distributed Trace and Individual Transaction Rule can only have one 'sample all' rule at a time
  const ruleWithoutConditionExists = rules
    .filter(r => r.type === type && !isEqual(r, rule))
    .some(r => !r.condition.inner.length);

  const submitDisabled =
    !defined(sampleRate) ||
    (ruleWithoutConditionExists && !conditions.length) ||
    !!conditions?.find(condition => {
      if (condition.category === SamplingInnerName.EVENT_LEGACY_BROWSER) {
        return !(condition.legacyBrowsers ?? []).length;
      }

      if (
        condition.category === SamplingInnerName.EVENT_LOCALHOST ||
        condition.category === SamplingInnerName.EVENT_BROWSER_EXTENSIONS ||
        condition.category === SamplingInnerName.EVENT_WEB_CRAWLERS
      ) {
        return false;
      }

      // They probably did not specify custom tag key
      if (
        condition.category === '' ||
        condition.category === SamplingInnerName.EVENT_CUSTOM_TAG
      ) {
        return true;
      }

      return !condition.match;
    });

  const customTagConditionsOptions = conditions
    .filter(
      condition =>
        isCustomTagName(condition.category) &&
        condition.category !== SamplingInnerName.EVENT_CUSTOM_TAG
    )
    .map(({category}) => ({
      value: category,
      label: (
        <Truncate value={getInnerNameLabel(category)} expandable={false} maxLength={40} />
      ),
      disabled: true,
      tooltip: conditionAlreadyAddedTooltip,
    }));

  const predefinedConditionsOptions = conditionCategories.map(([value, label]) => {
    // Never disable the "Add Custom Tag" option, you can add more of those
    const optionDisabled =
      value === SamplingInnerName.EVENT_CUSTOM_TAG
        ? false
        : conditions.some(condition => condition.category === value);
    return {
      value,
      label,
      disabled: optionDisabled,
      tooltip: disabled ? conditionAlreadyAddedTooltip : undefined,
    };
  });

  const {title, description} = getDescription();

  return (
    <Fragment>
      <Header closeButton>
        <h4>{title}</h4>
      </Header>
      <Body>
        <Fields>
          <Description>{description}</Description>
          <StyledPanel>
            <StyledPanelHeader hasButtons>
              {t('Conditions')}
              <StyledCompactSelect
                placement="bottom right"
                triggerLabel={
                  <TriggerLabel>
                    <IconAdd isCircled />
                    {t('Add Condition')}
                  </TriggerLabel>
                }
                triggerProps={{
                  size: 'small',
                  'aria-label': t('Add Condition'),
                }}
                placeholder={t('Filter conditions')}
                isOptionDisabled={opt => opt.disabled}
                options={[...customTagConditionsOptions, ...predefinedConditionsOptions]}
                value={conditions
                  // We need to filter our custom tag option so that it can be selected multiple times without being unselected every other time
                  .filter(({category}) => category !== SamplingInnerName.EVENT_CUSTOM_TAG)
                  .map(({category}) => category)}
                onChange={handleAddCondition}
                isSearchable
                multiple
                filterOption={(candidate, input) => {
                  // Always offer the "Add Custom Tag" option in the autocomplete
                  if (candidate.value === SamplingInnerName.EVENT_CUSTOM_TAG) {
                    return true;
                  }
                  return createFilter(null)(candidate, input);
                }}
                components={{
                  Option: containerProps => {
                    if (containerProps.value === SamplingInnerName.EVENT_CUSTOM_TAG) {
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
                <EmptyMessage
                  icon={<IconSearch size="xl" />}
                  title={t('No conditions added')}
                  description={
                    ruleWithoutConditionExists
                      ? tct(
                          'A rule without conditions already exists. [lineBreak]Add (+) a condition for creating a new rule',
                          {
                            lineBreak: <br />,
                          }
                        )
                      : tct(
                          "if you don't want to add (+) a condition, [lineBreak]simply, add a sample rate below",
                          {
                            lineBreak: <br />,
                          }
                        )
                  }
                />
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
            title={
              disabled
                ? t('You do not have permission to add sampling rules.')
                : submitDisabled
                ? t('Required fields must be filled out')
                : undefined
            }
            disabled={disabled || isSaving || submitDisabled}
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

const AddCustomTag = styled('div')<{isFocused: boolean}>`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(1.5)};
  gap: ${space(1)};
  line-height: 1.4;
  border-radius: ${p => p.theme.borderRadius};
  ${p => p.isFocused && `background: ${p.theme.hover};`};
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
