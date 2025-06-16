import {useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  NO_ARGUMENT_SPAN_AGGREGATES,
  prettifyTagKey,
} from 'sentry/utils/fields';
import {hasOurlogsAlertsFeature} from 'sentry/utils/ourlogs/features';
import type {AlertType} from 'sentry/views/alerts/wizard/options';
import {
  DEFAULT_VISUALIZATION_FIELD,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

const DEFAULT_EAP_AGGREGATION = 'count';
const DEFAULT_EAP_FIELD = 'span.duration';
const DEFAULT_EAP_METRICS_ALERT_FIELD = `${DEFAULT_EAP_AGGREGATION}(${DEFAULT_EAP_FIELD})`;

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  organization: Organization;
  alertType?: AlertType;
  onTraceItemChange?: (value: TraceItemDataset) => void;
  traceItemType?: TraceItemDataset;
}

// Use the same aggregates/operations available in the explore view
const OPERATIONS = [
  ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
    label: aggregate,
    value: aggregate,
  })),
];

const DEFAULT_ARGS_FOR_TRACE_ITEM_AGGREGATES: Record<
  string,
  Record<TraceItemDataset, string>
> = {
  count: {
    [TraceItemDataset.SPANS]: 'span.duration',
    [TraceItemDataset.LOGS]: 'message',
  },
};

function EAPFieldWrapper({
  aggregate,
  onChange,
  organization,
  alertType,
  traceItemType,
  onTraceItemChange,
}: Props) {
  return (
    <EAPField
      aggregate={aggregate}
      onChange={onChange}
      organization={organization}
      alertType={alertType}
      traceItemType={traceItemType}
      onTraceItemChange={onTraceItemChange}
    />
  );
}

function EAPField({
  aggregate,
  onChange,
  organization,
  alertType,
  traceItemType,
  onTraceItemChange,
}: Props) {
  // We parse out the aggregation and field from the aggregate string.
  // This only works for aggregates with <= 1 argument.
  const {
    name: aggregation,
    arguments: [field],
  } = parseFunction(aggregate) ?? {arguments: [undefined]};

  const {attributes: storedNumberTags} = useTraceItemAttributes('number');
  const {attributes: storedStringTags} = useTraceItemAttributes('string');

  const storedTags =
    aggregation === AggregationKey.COUNT_UNIQUE ? storedStringTags : storedNumberTags;
  const numberTags: TagCollection = useMemo(() => {
    const availableTags: TagCollection = storedTags;
    if (field && !defined(storedTags[field])) {
      availableTags[field] = {key: field, name: prettifyTagKey(field)};
    }
    return availableTags;
  }, [field, storedTags]);

  const fieldsArray = Object.values(numberTags);

  // When using the async variant of SelectControl, we need to pass in an option object instead of just the value
  const [lockOptions, selectedOption] = useMemo(() => {
    if (
      aggregation === AggregationKey.COUNT &&
      traceItemType === TraceItemDataset.SPANS
    ) {
      return [true, {label: t('spans'), value: DEFAULT_VISUALIZATION_FIELD}];
    }

    if (aggregation === AggregationKey.COUNT && traceItemType === TraceItemDataset.LOGS) {
      return [true, {label: t('logs'), value: OurLogKnownFieldKey.MESSAGE}];
    }

    if (
      aggregation &&
      NO_ARGUMENT_SPAN_AGGREGATES.includes(aggregation as AggregationKey)
    ) {
      return [true, {label: t('spans'), value: ''}];
    }

    const fieldName = fieldsArray.find(f => f.key === field)?.name;
    return [false, field && {label: fieldName, value: field}];
  }, [aggregation, field, fieldsArray, traceItemType]);

  useEffect(() => {
    if (lockOptions) {
      return;
    }

    const selectedMeta = field ? numberTags[field] : undefined;
    if (!field || !selectedMeta) {
      const newSelection = fieldsArray[0];
      if (newSelection) {
        onChange(`count(${newSelection.name})`, {});
      } else if (aggregate !== DEFAULT_EAP_METRICS_ALERT_FIELD) {
        onChange(DEFAULT_EAP_METRICS_ALERT_FIELD, {});
      }
    }
  }, [lockOptions, onChange, aggregate, aggregation, field, numberTags, fieldsArray]);

  const handleFieldChange = useCallback(
    (option: any) => {
      const selectedMeta = numberTags[option.value];
      if (!selectedMeta) {
        return;
      }
      onChange(`${aggregation}(${selectedMeta.key})`, {});
    },
    [numberTags, onChange, aggregation]
  );

  const handleOperationChange = useCallback(
    (option: any) => {
      const newAggregate = updateVisualizeAggregate({
        newAggregate: option.value,
        oldAggregate: aggregation || DEFAULT_EAP_AGGREGATION,
        oldArgument: field || DEFAULT_EAP_FIELD,
      });
      onChange(newAggregate, {});
    },
    [aggregation, field, onChange]
  );

  const handleTraceItemChange = useCallback(
    (option: any) => {
      const selectedAggregation = aggregation || DEFAULT_EAP_AGGREGATION;
      const newArg =
        DEFAULT_ARGS_FOR_TRACE_ITEM_AGGREGATES[selectedAggregation]?.[
          option.value as TraceItemDataset
        ];
      onChange(`${aggregation}(${newArg ?? ''})`, {});
      onTraceItemChange?.(option.value);
    },
    [aggregation, onChange, onTraceItemChange]
  );

  // As SelectControl does not support an options size limit out of the box
  // we work around it by using the async variant of the control
  const getFieldOptions = useCallback(
    (searchText: string) => {
      const filteredMeta = fieldsArray.filter(
        ({name}) =>
          searchText === '' || name.toLowerCase().includes(searchText.toLowerCase())
      );

      const options = filteredMeta.map(metric => {
        return {label: metric.name, value: metric.key};
      });
      return options;
    },
    [fieldsArray]
  );
  const supportedTraceItemTypes = [{label: t('Spans'), value: TraceItemDataset.SPANS}];
  if (alertType === 'trace_item_throughput' && hasOurlogsAlertsFeature(organization)) {
    supportedTraceItemTypes.push({label: t('Logs'), value: TraceItemDataset.LOGS});
  }

  return (
    <Wrapper>
      {supportedTraceItemTypes.length > 1 && (
        <StyledSelectControl
          label={t('Event')}
          options={supportedTraceItemTypes}
          value={traceItemType}
          onChange={handleTraceItemChange}
        />
      )}
      <StyledSelectControl
        searchable
        placeholder={t('Select an operation')}
        options={OPERATIONS}
        value={aggregation}
        onChange={handleOperationChange}
      />
      <StyledSelectControl
        searchable
        placeholder={t('Select a metric')}
        noOptionsMessage={() =>
          fieldsArray.length === 0 ? t('No metrics in this project') : t('No options')
        }
        async
        defaultOptions={getFieldOptions('')}
        loadOptions={(searchText: any) => Promise.resolve(getFieldOptions(searchText))}
        value={selectedOption}
        onChange={handleFieldChange}
        disabled={lockOptions}
      />
    </Wrapper>
  );
}

export default EAPFieldWrapper;

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledSelectControl = styled(Select)`
  width: 200px;
`;
