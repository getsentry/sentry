import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {t, tct} from 'sentry/locale';
import type {Environment} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AGE_COMPARISON_CHOICES,
  type AgeComparison,
  MODEL_AGE_CHOICES,
  type ModelAge,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function LatestAdoptedReleaseNode() {
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
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.release_age_type`}
      value={condition.comparison.release_age_type}
      options={MODEL_AGE_CHOICES}
      onChange={(value: ModelAge) => {
        onUpdate({
          match: value,
        });
      }}
    />
  );
}

function AgeComparisonField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.age_comparison`}
      value={condition.comparison.age_comparison}
      options={AGE_COMPARISON_CHOICES}
      onChange={(value: AgeComparison) => {
        onUpdate({
          match: value,
        });
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
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.environment`}
      value={condition.comparison.environment}
      options={environmentOptions}
      placeholder={t('environment')}
      onChange={(value: string) => {
        onUpdate({
          environment: value,
        });
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
