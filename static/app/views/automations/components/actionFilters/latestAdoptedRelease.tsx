import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Environment} from 'sentry/types/project';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AGE_COMPARISON_CHOICES,
  type AgeComparison,
  MODEL_AGE_CHOICES,
  type ModelAge,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function LatestAdoptedReleaseDetails({condition}: {condition: DataCondition}) {
  return tct(
    "The [releaseAgeType] adopted release associated with the event's issue is [ageComparison] the latest adopted release in [environment]",
    {
      releaseAgeType:
        MODEL_AGE_CHOICES.find(
          choice => choice.value === condition.comparison.release_age_type
        )?.label || condition.comparison.release_age_type,
      ageComparison:
        AGE_COMPARISON_CHOICES.find(
          choice => choice.value === condition.comparison.age_comparison
        )?.label || condition.comparison.age_comparison,
      environment: condition.comparison.environment,
    }
  );
}

export function LatestAdoptedReleaseNode() {
  return tct(
    "The [releaseAgeType] adopted release associated with the event's issue is [ageComparison] the latest adopted release in [environment]",
    {
      releaseAgeType: <ReleaseAgeTypeField />,
      ageComparison: <AgeComparisonField />,
      environment: <EnvironmentField />,
    }
  );
}

function ReleaseAgeTypeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.release_age_type`}
      value={condition.comparison.release_age_type}
      options={MODEL_AGE_CHOICES}
      onChange={(option: SelectValue<ModelAge>) => {
        onUpdate({comparison: {...condition.comparison, release_age_type: option.value}});
      }}
    />
  );
}

function AgeComparisonField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.age_comparison`}
      value={condition.comparison.age_comparison}
      options={AGE_COMPARISON_CHOICES}
      onChange={(option: SelectValue<AgeComparison>) => {
        onUpdate({comparison: {...condition.comparison, age_comparison: option.value}});
      }}
    />
  );
}

function EnvironmentField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();

  const {environments} = useOrganizationEnvironments();
  const environmentOptions = environments.map(({id, name}) => ({
    value: id,
    label: name,
  }));

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.environment`}
      value={condition.comparison.environment}
      options={environmentOptions}
      placeholder={t('environment')}
      onChange={(option: SelectValue<string>) => {
        onUpdate({comparison: {...condition.comparison, environment: option.value}});
      }}
    />
  );
}

function useOrganizationEnvironments() {
  const organization = useOrganization();
  const {data: environments = [], isLoading} = useApiQuery<Environment[]>(
    [
      `/organizations/${organization.slug}/environments/`,
      {query: {visibility: 'visible'}},
    ],
    {
      staleTime: 30_000,
    }
  );
  return {environments, isLoading};
}
