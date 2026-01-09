import {useMemo} from 'react';

import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Tag} from 'sentry/types/group';
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

  // TODO - get form context, get the detector ids from the context.
  // if there are connected detectors / projects, then grab the project id list and use that. otherwise, -1.
  const projectIds = ['-1'];

  // Select all the tags for an organization to generate a list of the most likely tags
  const organization = useOrganization();
  const {data: tagOptions = [], isLoading} = useFetchOrganizationTags(
    {
      orgSlug: organization.slug,
      projectIds,
      dataset: Dataset.ISSUE_PLATFORM,
      useCache: true,
      keepPreviousData: true,
    },
    {}
  );

  const sortedOptions = useMemo(() => {
    const sorted = tagOptions.toSorted((a, b) => {
      return (a.totalValues || 0) > (b.totalValues || 0) ? -1 : 1;
    });

    if (
      condition.comparison.key &&
      !sorted.some(tag => tag.key === condition.comparison.key)
    ) {
      sorted.unshift(condition.comparison);
    }

    return Object.values(sorted).map((tag: Tag) => ({
      value: tag.key,
      label: tag.key,
    }));
  }, [tagOptions, condition.comparison]);

  return (
    <AutomationBuilderSelect
      disabled={isLoading}
      creatable
      name={`${condition_id}.comparison.key`}
      aria-label={t('Tag')}
      placeholder={isLoading ? t('Loading tags\u2026') : t('tag')}
      value={condition.comparison.key}
      options={sortedOptions}
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
