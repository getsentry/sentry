import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {
  MetricAggregation,
  MetricsExtractionCondition,
  MetricsExtractionRule,
  MRI,
} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {isCounterMetric} from 'sentry/utils/metrics';
import {aggregationToMetricType} from 'sentry/utils/metrics/extractionRules';
import {MRIToField, parseField} from 'sentry/utils/metrics/mri';
import useOrganization from 'sentry/utils/useOrganization';
import {useMetricsExtractionRules} from 'sentry/views/settings/projectMetrics/utils/useMetricsExtractionRules';

interface Props {
  field: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  project: Project;
}

function findMriForAggregate(
  condition: MetricsExtractionCondition | undefined,
  aggregate: MetricAggregation
) {
  const requestedType = aggregationToMetricType[aggregate];
  return condition?.mris.find(mri => mri.startsWith(requestedType));
}

function SpanMetricField({field, project, onChange}: Props) {
  const organization = useOrganization();
  const {data: extractionRules, isPending} = useMetricsExtractionRules({
    orgId: organization.slug,
    projectId: project.id,
  });

  const parsedField = useMemo(() => parseField(field), [field]);
  const selectedAggregate =
    // Internally we use `sum` for counter metrics but expose `count` to the user
    parsedField?.aggregation === 'sum' ? 'count' : parsedField?.aggregation;

  const [selectedRule, selectedCondition] = useMemo(() => {
    if (!extractionRules || !parsedField) {
      return [null, null];
    }

    let rule: MetricsExtractionRule | null = null;
    let condition: MetricsExtractionCondition | null = null;

    for (const currentRule of extractionRules || []) {
      for (const currentCondition of currentRule.conditions) {
        if (currentCondition.mris.includes(parsedField.mri)) {
          rule = currentRule;
          condition = currentCondition;
          break;
        }
      }

      if (rule) {
        break;
      }
    }

    return [rule, condition];
  }, [extractionRules, parsedField]);

  const attributeOptions = useMemo(() => {
    return (
      extractionRules
        ?.map(rule => ({
          label: rule.spanAttribute,
          value: rule.spanAttribute,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)) ?? []
    );
  }, [extractionRules]);

  const aggregateOptions = useMemo(() => {
    return (
      selectedRule?.aggregates.map(agg => ({
        label: agg,
        value: agg,
      })) ?? []
    );
  }, [selectedRule]);

  const conditionOptions = useMemo(() => {
    return selectedRule?.conditions.map(condition => ({
      label: condition.value ? (
        <Tooltip showOnlyOnOverflow title={condition.value} skipWrapper>
          <ConditionLabel>{condition.value}</ConditionLabel>
        </Tooltip>
      ) : (
        t('All spans')
      ),
      value: condition.id,
    }));
  }, [selectedRule]);

  const handleChange = useCallback(
    (newMRI: MRI, newAggregate: MetricAggregation) => {
      if (isCounterMetric({mri: newMRI})) {
        // We expose `count` to the user but the internal aggregation for a counter metric is `sum`
        onChange(MRIToField(newMRI, 'sum'), {});
        return;
      }
      onChange(MRIToField(newMRI, newAggregate), {});
    },
    [onChange]
  );

  const handleMriChange = useCallback(
    option => {
      const newRule = extractionRules?.find(rule => rule.spanAttribute === option.value);
      if (!newRule) {
        return;
      }

      const newAggregate = newRule.aggregates[0];
      if (!newAggregate) {
        // Encoutered invalid extraction rule
        return;
      }

      const newMRI = findMriForAggregate(newRule.conditions[0], newAggregate);
      if (!newMRI) {
        // Encoutered invalid extraction rule
        return;
      }

      handleChange(newMRI, newAggregate);
    },
    [extractionRules, handleChange]
  );

  const handleConditionChange = useCallback(
    option => {
      if (!selectedRule || !selectedAggregate) {
        return;
      }

      const newCondition = selectedRule.conditions.find(
        condition => condition.id === option.value
      );
      if (!newCondition) {
        return;
      }

      // Find an MRI for the currently selected aggregate
      const newMRI = findMriForAggregate(newCondition, selectedAggregate);
      if (!newMRI) {
        // Encoutered invalid extraction rule
        return;
      }

      handleChange(newMRI, selectedAggregate);
    },
    [handleChange, selectedAggregate, selectedRule]
  );

  const handleAggregateChange = useCallback(
    option => {
      if (!selectedCondition) {
        return;
      }

      const newMRI = findMriForAggregate(selectedCondition, option.value);
      if (!newMRI) {
        return;
      }

      handleChange(newMRI, option.value);
    },
    [handleChange, selectedCondition]
  );

  return (
    <Fragment>
      <SelectControl
        searchable
        isDisabled={isPending}
        placeholder={t('Select a metric')}
        noOptionsMessage={() =>
          attributeOptions.length === 0
            ? t('No span metrics in this project')
            : t('No options')
        }
        options={attributeOptions}
        filterOption={() => true}
        value={selectedRule?.spanAttribute}
        onChange={handleMriChange}
      />
      <SelectControl
        searchable
        isDisabled={isPending || !selectedRule}
        placeholder={t('Select a filter')}
        options={conditionOptions}
        value={selectedCondition?.id}
        onChange={handleConditionChange}
      />
      <SelectControl
        searchable
        isDisabled={isPending || !selectedRule}
        placeholder={t('Select an aggregate')}
        options={aggregateOptions}
        value={selectedAggregate}
        onChange={handleAggregateChange}
      />
    </Fragment>
  );
}

export default SpanMetricField;

const ConditionLabel = styled('code')`
  padding-left: 0;
  max-width: 350px;
  ${p => p.theme.overflowEllipsis}
`;
