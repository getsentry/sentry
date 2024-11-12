import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {
  DEFAULT_EAP_FIELD,
  DEFAULT_EAP_METRICS_ALERT_FIELD,
} from 'sentry/utils/metrics/mri';
import {
  SpanTagsProvider,
  useSpanTags,
} from 'sentry/views/explore/contexts/spanTagsContext';

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
  return (
    <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP}>
      <EAPField aggregate={aggregate} onChange={onChange} />
    </SpanTagsProvider>
  );
}

function EAPField({aggregate, onChange}: Props) {
  // We parse out the aggregation and field from the aggregate string.
  // This only works for aggregates with <= 1 argument.
  const {
    name: aggregation,
    arguments: [field],
  } = parseFunction(aggregate) ?? {arguments: [undefined]};

  const numberTags = useSpanTags('number');
  const fieldsArray = Object.values(numberTags);

  useEffect(() => {
    const selectedMeta = field ? numberTags[field] : undefined;
    if (field && !selectedMeta) {
      const newSelection = fieldsArray[0];
      if (newSelection) {
        onChange(`count(${newSelection.name})`, {});
      } else if (aggregate !== DEFAULT_EAP_METRICS_ALERT_FIELD) {
        onChange(DEFAULT_EAP_METRICS_ALERT_FIELD, {});
      }
    }
  }, [onChange, aggregate, aggregation, field, numberTags, fieldsArray]);

  const handleFieldChange = useCallback(
    option => {
      const selectedMeta = numberTags[option.value];
      if (!selectedMeta) {
        return;
      }
      onChange(`${aggregation}(${selectedMeta.key})`, {});
    },
    [numberTags, onChange, aggregation]
  );

  const handleOperationChange = useCallback(
    option => {
      if (field) {
        onChange(`${option.value}(${field})`, {});
      } else {
        onChange(`${option.value}(${DEFAULT_EAP_FIELD})`, {});
      }
    },
    [field, onChange]
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
        return {
          label: metric.name,
          value: metric.key,
        };
      });
      return options;
    },
    [fieldsArray]
  );

  // When using the async variant of SelectControl, we need to pass in an option object instead of just the value
  const selectedOption = field && {
    label: field,
    value: field,
  };

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
        loadOptions={searchText => Promise.resolve(getFieldOptions(searchText))}
        filterOption={() => true}
        value={selectedOption}
        onChange={handleFieldChange}
      />
    </Wrapper>
  );
}

export default EAPFieldWrapper;

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledSelectControl = styled(SelectControl)`
  width: 200px;
`;
