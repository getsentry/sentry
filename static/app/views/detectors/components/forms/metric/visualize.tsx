import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import FormContext from 'sentry/components/forms/formContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {AggregateParameter} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  FieldValueType,
  getFieldDefinition,
  prettifyTagKey,
} from 'sentry/utils/fields';
import {unreachable} from 'sentry/utils/unreachable';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {useCustomMeasurements} from 'sentry/views/detectors/datasetConfig/useCustomMeasurements';
import {
  useTraceItemNumberAttributes,
  useTraceItemStringAttributes,
} from 'sentry/views/detectors/datasetConfig/useTraceItemAttributes';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {DEFAULT_VISUALIZATION_FIELD} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {TraceItemDataset} from 'sentry/views/explore/types';

/**
 * Render a tag badge for field types, similar to dashboard widget builder
 */
function renderTag(kind: FieldValueKind): React.ReactNode {
  let text: string | undefined;
  let tagVariant: TagProps['variant'] | undefined;

  switch (kind) {
    case FieldValueKind.FUNCTION:
      text = 'f(x)';
      tagVariant = 'warning';
      break;
    case FieldValueKind.CUSTOM_MEASUREMENT:
    case FieldValueKind.MEASUREMENT:
      text = 'field';
      tagVariant = 'info';
      break;
    case FieldValueKind.BREAKDOWN:
      text = 'field';
      tagVariant = 'info';
      break;
    case FieldValueKind.TAG:
      text = 'tag';
      tagVariant = 'warning';
      break;
    case FieldValueKind.NUMERIC_METRICS:
      text = 'f(x)';
      tagVariant = 'warning';
      break;
    case FieldValueKind.FIELD:
      text = 'field';
      tagVariant = 'info';
      break;
    case FieldValueKind.EQUATION:
      text = 'equation';
      tagVariant = 'warning';
      break;
    case FieldValueKind.METRICS:
      text = 'metrics';
      tagVariant = 'warning';
      break;
    default:
      unreachable(kind);
      throw new Error(`Invalid field value kind: ${kind}`);
  }

  return <Tag variant={tagVariant}>{text}</Tag>;
}

/**
 * Aggregate options excluded for the logs dataset
 */
const LOGS_EXCLUDED_AGGREGATES = [
  AggregationKey.FAILURE_RATE,
  AggregationKey.FAILURE_COUNT,
  AggregationKey.APDEX,
];

const ADDITIONAL_EAP_AGGREGATES = [AggregationKey.APDEX];

/**
 * Locks the primary dropdown to the single option
 */
const LOCKED_SPAN_AGGREGATES = {
  [AggregationKey.APDEX]: {
    value: DEFAULT_VISUALIZATION_FIELD,
    label: 'span.duration',
  },
  [AggregationKey.COUNT]: {
    value: DEFAULT_VISUALIZATION_FIELD,
    label: 'spans',
  },
};

// Type guard for locked span aggregates
const isLockedSpanAggregate = (
  agg: string
): agg is keyof typeof LOCKED_SPAN_AGGREGATES => {
  return agg in LOCKED_SPAN_AGGREGATES;
};

function getEAPAllowedAggregates(dataset: DetectorDataset): Array<[string, string]> {
  return [...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES, ...ADDITIONAL_EAP_AGGREGATES]
    .filter(aggregate => {
      if (dataset === DetectorDataset.LOGS) {
        return !LOGS_EXCLUDED_AGGREGATES.includes(aggregate);
      }
      return true;
    })
    .map(aggregate => [aggregate, aggregate]);
}

function getAggregateOptions(
  dataset: DetectorDataset,
  tableFieldOptions: Record<string, SelectValue<FieldValue>>
): Array<[string, string]> {
  // For spans dataset, use the predefined aggregates
  if (dataset === DetectorDataset.SPANS || dataset === DetectorDataset.LOGS) {
    return getEAPAllowedAggregates(dataset);
  }

  // For other datasets, extract function-type options from tableFieldOptions
  const functionOptions = Object.values(tableFieldOptions)
    .filter(option => option.value?.kind === 'function')
    .map((option): [string, string] => [option.value.meta.name, option.value.meta.name]);

  // If no function options available, fall back to the predefined aggregates
  if (functionOptions.length === 0) {
    return getEAPAllowedAggregates(dataset);
  }

  return functionOptions.sort((a, b) => a[1].localeCompare(b[1]));
}

/**
 * Get aggregate metadata from tableFieldOptions
 */
function getAggregateOptionMetadata(
  aggregateName: string,
  tableFieldOptions: Record<string, SelectValue<FieldValue>>
): {name: string; parameters: AggregateParameter[]} | null {
  const optionKey = `function:${aggregateName}`;
  const option = tableFieldOptions[optionKey];

  if (!option?.value?.meta) {
    return null;
  }

  // Type guard to check if meta has parameters
  const meta = option.value.meta;
  if ('parameters' in meta) {
    return {
      name: meta.name,
      parameters: meta.parameters,
    };
  }

  return {
    name: meta.name,
    parameters: [],
  };
}

/**
 * Parse aggregateFunction string into UI components
 */
function parseAggregateFunction(aggregateFunction: string) {
  if (!aggregateFunction) {
    return {
      aggregate: '',
      parameters: [],
    };
  }

  const parsed = parseFunction(aggregateFunction);
  if (!parsed) {
    return {
      aggregate: aggregateFunction,
      parameters: [],
    };
  }

  return {
    aggregate: parsed.name,
    parameters: parsed.arguments || [],
  };
}

/**
 * Combine UI components into aggregateFunction string
 */
function buildAggregateFunction(aggregate: string, parameters: string[]): string {
  if (!aggregate) {
    return '';
  }

  const validParameters = parameters.filter(param => param && param.trim() !== '');
  return `${aggregate}(${validParameters.join(',')})`;
}

export function Visualize() {
  const organization = useOrganization();
  const {customMeasurements} = useCustomMeasurements();
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const tags = useTags();

  const traceItemType =
    dataset === DetectorDataset.SPANS ? TraceItemDataset.SPANS : TraceItemDataset.LOGS;
  const {attributes: numericSpanTags} = useTraceItemNumberAttributes({
    traceItemType,
    projectIds: [Number(projectId)],
  });
  const {attributes: stringSpanTags} = useTraceItemStringAttributes({
    traceItemType,
    projectIds: [Number(projectId)],
  });
  const formContext = useContext(FormContext);

  const isTransactionsDataset = dataset === DetectorDataset.TRANSACTIONS;

  // Parse the aggregateFunction into UI components on each render
  const {aggregate, parameters} = useMemo(() => {
    return parseAggregateFunction(aggregateFunction);
  }, [aggregateFunction]);

  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);

  const aggregateOptions = useMemo(() => {
    return datasetConfig.getAggregateOptions(organization, tags, customMeasurements);
  }, [organization, tags, datasetConfig, customMeasurements]);

  const fieldOptions = useMemo(() => {
    // For Spans dataset, use span-specific options from the provider
    if (dataset === DetectorDataset.SPANS || dataset === DetectorDataset.LOGS) {
      // Use field definition to determine what options should be displayed
      const fieldDefinition = getFieldDefinition(
        aggregate,
        dataset === DetectorDataset.SPANS ? 'span' : 'log'
      );
      let isTypeAllowed = (_valueType: FieldValueType) => true;
      if (fieldDefinition?.parameters?.[0]?.kind === 'column') {
        const columnTypes = fieldDefinition?.parameters[0]?.columnTypes;
        isTypeAllowed = (valueType: FieldValueType) =>
          typeof columnTypes === 'function'
            ? columnTypes({key: '', valueType})
            : columnTypes.includes(valueType);
      }
      const spanColumnOptions: Array<[string, string]> = [
        ...(isTypeAllowed(FieldValueType.STRING)
          ? Object.values(stringSpanTags).map((tag): [string, string] => [
              tag.key,
              prettifyTagKey(tag.name),
            ])
          : []),
        ...(isTypeAllowed(FieldValueType.NUMBER)
          ? Object.values(numericSpanTags).map((tag): [string, string] => [
              tag.key,
              prettifyTagKey(tag.name),
            ])
          : []),
      ];
      return spanColumnOptions.sort((a, b) => a[1].localeCompare(b[1]));
    }

    return Object.values(aggregateOptions)
      .filter(
        option =>
          option.value.kind !== 'function' && // Exclude functions for field selection
          option.value.kind !== 'equation' // Exclude equations
      )
      .map((option): [string, string] => [option.value.meta.name, option.value.meta.name])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [dataset, stringSpanTags, numericSpanTags, aggregateOptions, aggregate]);

  const fieldOptionsDropdown = useMemo(() => {
    return fieldOptions.map(([value, label]) => ({
      value,
      label,
      trailingItems: renderTag(FieldValueKind.FIELD),
    }));
  }, [fieldOptions]);

  const aggregateDropdownOptions = useMemo((): Array<SelectValue<string>> => {
    return getAggregateOptions(dataset, aggregateOptions).map(([value, label]) => ({
      value,
      label,
      trailingItems: renderTag(FieldValueKind.FUNCTION),
    }));
  }, [dataset, aggregateOptions]);

  // Get parameter metadata for the selected aggregate
  const aggregateMetadata = useMemo(() => {
    return aggregate ? getAggregateOptionMetadata(aggregate, aggregateOptions) : null;
  }, [aggregate, aggregateOptions]);

  // Helper to update the aggregateFunction field in the form model
  const updateAggregateFunction = (newAggregate: string, newParameters: string[]) => {
    const newAggregateFunction = buildAggregateFunction(newAggregate, newParameters);
    formContext.form?.setValue(
      METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
      newAggregateFunction
    );
  };

  /**
   * Manages parameter compatibility
   */
  const handleAggregateChange = (newAggregate: string) => {
    const newMetadata = getAggregateOptionMetadata(newAggregate, aggregateOptions);
    const newParameters: string[] = [];

    if (newMetadata?.parameters) {
      newMetadata.parameters.forEach((param, index) => {
        if (param.defaultValue) {
          newParameters[index] = param.defaultValue;
        } else if (param.kind === 'column' && fieldOptions[0]) {
          newParameters[index] = fieldOptions[0][0];
        } else {
          newParameters[index] = '';
        }
      });
    }

    updateAggregateFunction(newAggregate, newParameters);
  };

  // Helper to update a specific parameter
  const handleParameterChange = (paramIndex: number, value: string) => {
    const newParameters = [...parameters];
    newParameters[paramIndex] = value;
    updateAggregateFunction(aggregate, newParameters);
  };

  const lockSpanOptions =
    dataset === DetectorDataset.SPANS && isLockedSpanAggregate(aggregate);

  // Get locked option if applicable, with proper type narrowing
  const lockedOption = lockSpanOptions ? LOCKED_SPAN_AGGREGATES[aggregate] : null;

  return (
    <Flex direction="column" gap="md">
      <Flex gap="md" align="end">
        <FieldContainer>
          <div>
            <Tooltip
              title={t(
                'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
              )}
              showUnderline
            >
              <SectionLabel>{t('Visualize')}</SectionLabel>
            </Tooltip>
          </div>
          <StyledAggregateSelect
            searchable
            triggerProps={{children: aggregate || t('Select aggregate')}}
            options={aggregateDropdownOptions}
            value={aggregate}
            onChange={option => {
              handleAggregateChange(String(option.value));
            }}
            disabled={isTransactionsDataset}
          />
        </FieldContainer>
        {aggregateMetadata?.parameters?.map((param, index) => {
          return (
            <FieldContainer key={index}>
              {param.kind === 'column' ? (
                <StyledVisualizeSelect
                  searchable
                  triggerProps={{
                    children: lockedOption
                      ? lockedOption.label
                      : parameters[index] || param.defaultValue || t('Select metric'),
                  }}
                  options={lockedOption ? [lockedOption] : fieldOptionsDropdown}
                  value={
                    lockedOption
                      ? DEFAULT_VISUALIZATION_FIELD
                      : parameters[index] || param.defaultValue || ''
                  }
                  onChange={option => {
                    handleParameterChange(index, String(option.value));
                  }}
                  disabled={isTransactionsDataset}
                />
              ) : param.kind === 'dropdown' && param.options ? (
                <StyledVisualizeSelect
                  searchable
                  triggerProps={{
                    children:
                      parameters[index] || param.defaultValue || t('Select value'),
                  }}
                  options={param.options.map(option => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  value={parameters[index] || param.defaultValue || ''}
                  onChange={option => {
                    handleParameterChange(index, String(option.value));
                  }}
                  disabled={isTransactionsDataset}
                />
              ) : (
                <StyledParameterInput
                  size="md"
                  placeholder={param.defaultValue || t('Enter value')}
                  value={parameters[index] || ''}
                  onChange={e => {
                    handleParameterChange(index, e.target.value);
                  }}
                  disabled={isTransactionsDataset}
                />
              )}
            </FieldContainer>
          );
        })}
      </Flex>
    </Flex>
  );
}

const FieldContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;
  max-width: 425px;
`;

const StyledAggregateSelect = styled(CompactSelect)`
  width: 100%;
  max-width: 425px;
  & > button {
    width: 100%;
    font-weight: normal;
  }
`;

const StyledVisualizeSelect = styled(CompactSelect)`
  width: 100%;
  max-width: 425px;
  & > button {
    width: 100%;
    font-weight: normal;
  }
`;

const StyledParameterInput = styled(Input)`
  flex: 1;
`;
