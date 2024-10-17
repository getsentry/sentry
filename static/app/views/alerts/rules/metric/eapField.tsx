import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';

export const DEFAULT_EAP_FIELD = 'span.duration';
export const DEFAULT_EAP_METRICS_ALERT_FIELD = `count(${DEFAULT_EAP_FIELD})`;

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  project: Project;
}

// Use the same aggregates/operations available in the explore view
const OPERATIONS = [
  ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
    label: aggregate,
    value: aggregate,
  })),
];

// TODD(edward): Just hardcode the EAP fields for now. We should use SpanTagsProvider in the future to match the Explore UI.
const EAP_FIELD_OPTIONS = [
  {
    name: 'span.duration',
  },
  {
    name: 'span.self_time',
  },
];

function EAPField({aggregate, onChange}: Props) {
  // We parse out the aggregation and field from the aggregate string.
  // This only works for aggregates with <= 1 argument.
  const {
    name: aggregation,
    arguments: [field],
  } = parseFunction(aggregate) ?? {arguments: [undefined]};

  useEffect(() => {
    const selectedMriMeta = EAP_FIELD_OPTIONS.find(metric => metric.name === field);
    if (field && !selectedMriMeta) {
      const newSelection = EAP_FIELD_OPTIONS[0];
      if (newSelection) {
        onChange(`count(${newSelection.name})`, {});
      } else if (aggregate !== DEFAULT_EAP_METRICS_ALERT_FIELD) {
        onChange(DEFAULT_EAP_METRICS_ALERT_FIELD, {});
      }
    }
  }, [onChange, aggregate, aggregation, field]);

  const handleFieldChange = useCallback(
    option => {
      const selectedMeta = EAP_FIELD_OPTIONS.find(metric => metric.name === option.value);
      if (!selectedMeta) {
        return;
      }
      onChange(`${aggregation}(${option.value})`, {});
    },
    [onChange, aggregation]
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
  const getFieldOptions = useCallback((searchText: string) => {
    const filteredMeta = EAP_FIELD_OPTIONS.filter(
      ({name}) =>
        searchText === '' || name.toLowerCase().includes(searchText.toLowerCase())
    );

    const options = filteredMeta.map(metric => {
      return {
        label: metric.name,
        value: metric.name,
      };
    });
    return options;
  }, []);

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
          EAP_FIELD_OPTIONS.length === 0
            ? t('No metrics in this project')
            : t('No options')
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

export default EAPField;

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledSelectControl = styled(SelectControl)`
  width: 200px;
`;
