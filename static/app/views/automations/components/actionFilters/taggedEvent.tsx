import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  MATCH_CHOICES,
  type MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function TaggedEventDetails({condition}: {condition: DataCondition}) {
  return tct("The event's [key] tag [match] [value]", {
    key: condition.comparison.key,
    match:
      MATCH_CHOICES.find(choice => choice.value === condition.comparison.match)?.label ||
      condition.comparison.match,
    value: condition.comparison.value,
  });
}

export function TaggedEventNode() {
  return tct("The event's [key] [match] [value]", {
    key: <KeyField />,
    match: <MatchField />,
    value: <ValueField />,
  });
}

function KeyField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  // Select all the tags for an organization to generate a list of the most likely tags
  const organization = useOrganization();
  const {data: tagOptions, isLoading} = useFetchOrganizationTags(
    {
      orgSlug: organization.slug,
      projectIds: ['-1'],
      dataset: Dataset.ERRORS,
      useCache: true,
      enabled: true,
      keepPreviousData: true,
    },
    {}
  );

  if (!tagOptions || isLoading) {
    return <LoadingIndicator mini size={24} style={{alignItems: 'center'}} />;
  }

  const tags = tagOptions.sort((a, b) => a.key.localeCompare(b.key));
  if (
    condition.comparison.key &&
    !tags.some(tag => tag.key === condition.comparison.key)
  ) {
    tags.unshift(condition.comparison);
  }

  return (
    <AutomationBuilderSelect
      creatable
      name={`${condition_id}.comparison.key`}
      aria-label={t('Tag')}
      placeholder={t('tag')}
      value={condition.comparison.key}
      options={Object.values(tags).map(tag => ({
        value: tag.key,
        label: tag.key,
      }))}
      onChange={(e: SelectValue<MatchType>) => {
        onUpdate({comparison: {...condition.comparison, key: e.value}});
        removeError(condition.id);
      }}
    />
  );
}

function MatchField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.match`}
      aria-label={t('Match type')}
      value={condition.comparison.match ?? ''}
      options={MATCH_CHOICES}
      onChange={(value: SelectValue<MatchType>) => {
        onUpdate({comparison: {...condition.comparison, match: value.value}});
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Value')}
      placeholder={t('value')}
      value={condition.comparison.value ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({comparison: {...condition.comparison, value: e.target.value}});
        removeError(condition.id);
      }}
    />
  );
}

export function validateTaggedEventCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (
    !condition.comparison.key ||
    !condition.comparison.match ||
    !condition.comparison.value
  ) {
    return t('Ensure all fields are filled in.');
  }
  return undefined;
}
