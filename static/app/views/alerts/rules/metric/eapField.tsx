import {useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  NO_ARGUMENT_SPAN_AGGREGATES,
  prettifyTagKey,
} from 'sentry/utils/fields';
import {
  DEFAULT_VISUALIZATION_FIELD,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

const DEFAULT_EAP_AGGREGATION = 'count';
const DEFAULT_EAP_FIELD = 'span.duration';
const DEFAULT_EAP_METRICS_ALERT_FIELD = `${DEFAULT_EAP_AGGREGATION}(${DEFAULT_EAP_FIELD})`;

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
}

// Use the same aggregates/operations available in the explore view
const OPERATIONS = [
  ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
    label: aggregate,
    value: aggregate,
  })),
];

function EAPFieldWrapper({aggregate, onChange}: Props) {
  return <EAPField aggregate={aggregate} onChange={onChange} />;
}

function EAPField({aggregate, onChange}: Props) {
  // We parse out the aggregation and field from the aggregate string.
  // This only works for aggregates with <= 1 argument.
  const {
    name: aggregation,
    arguments: [field],
  } = parseFunction(aggregate) ?? {arguments: [undefined]};

  const {tags: storedStringTags} = useSpanTags('string');
  const {tags: storedNumberTags} = useSpanTags('number');
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
    if (aggregation === AggregationKey.COUNT) {
      return [true, {label: t('spans'), value: DEFAULT_VISUALIZATION_FIELD}];
    }

    if (
      aggregation &&
      NO_ARGUMENT_SPAN_AGGREGATES.includes(aggregation as AggregationKey)
    ) {
      return [true, {label: t('spans'), value: ''}];
    }

    const fieldName = fieldsArray.find(f => f.key === field)?.name;
    return [false, field && {label: fieldName, value: field}];
  }, [aggregation, field, fieldsArray]);

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

  return (
    <Wrapper>
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
