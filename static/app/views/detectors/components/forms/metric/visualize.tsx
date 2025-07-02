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
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES, prettifyTagKey} from 'sentry/utils/fields';
import {unreachable} from 'sentry/utils/unreachable';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {
  DetectorDataset,
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {DetectorQueryFilterBuilder} from 'sentry/views/detectors/components/forms/metric/queryFilterBuilder';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {useCustomMeasurements} from 'sentry/views/detectors/datasetConfig/useCustomMeasurements';
import {
  useTraceItemNumberAttributes,
  useTraceItemStringAttributes,
} from 'sentry/views/detectors/datasetConfig/useTraceItemsAttributeQuery';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

/**
 * Render a tag badge for field types, similar to dashboard widget builder
 */
function renderTag(kind: FieldValueKind): React.ReactNode {
  let text: string | undefined;
  let tagType: TagProps['type'] | undefined;

  switch (kind) {
    case FieldValueKind.FUNCTION:
      text = 'f(x)';
      tagType = 'warning';
      break;
    case FieldValueKind.CUSTOM_MEASUREMENT:
    case FieldValueKind.MEASUREMENT:
      text = 'field';
      tagType = 'highlight';
      break;
    case FieldValueKind.BREAKDOWN:
      text = 'field';
      tagType = 'highlight';
      break;
    case FieldValueKind.TAG:
      text = 'tag';
      tagType = 'warning';
      break;
    case FieldValueKind.NUMERIC_METRICS:
      text = 'f(x)';
      tagType = 'warning';
      break;
    case FieldValueKind.FIELD:
      text = 'field';
      tagType = 'highlight';
      break;
    case FieldValueKind.EQUATION:
      text = 'equation';
      tagType = 'warning';
      break;
    case FieldValueKind.METRICS:
      text = 'metrics';
      tagType = 'warning';
      break;
    default:
      unreachable(kind);
      throw new Error(`Invalid field value kind: ${kind}`);
  }

  return <Tag type={tagType}>{text}</Tag>;
}

function getAggregateOptions(
  dataset: DetectorDataset,
  tableFieldOptions: Record<string, SelectValue<FieldValue>>
): Array<[string, string]> {
  // For spans dataset, use the predefined aggregates
  if (dataset === DetectorDataset.SPANS || dataset === DetectorDataset.LOGS) {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => [aggregate, aggregate]);
  }

  // For other datasets, extract function-type options from tableFieldOptions
  const functionOptions = Object.values(tableFieldOptions)
    .filter(option => option.value?.kind === 'function')
    .map((option): [string, string] => [option.value.meta.name, option.value.meta.name]);

  // If no function options available, fall back to the predefined aggregates
  if (functionOptions.length === 0) {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => [aggregate, aggregate]);
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

  const {attributes: numericSpanTags} = useTraceItemNumberAttributes({
    traceItemType: TraceItemDataset.SPANS,
    projectIds: [Number(projectId)],
  });
  const {attributes: stringSpanTags} = useTraceItemStringAttributes({
    traceItemType: TraceItemDataset.SPANS,
    projectIds: [Number(projectId)],
  });
  const formContext = useContext(FormContext);

  // Parse the aggregateFunction into UI components on each render
  const {aggregate, parameters} = useMemo(() => {
    return parseAggregateFunction(aggregateFunction);
  }, [aggregateFunction]);

  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);

  const aggregateOptions = useMemo(
    () => datasetConfig.getAggregateOptions(organization, tags, customMeasurements),
    [organization, tags, datasetConfig, customMeasurements]
  );

  const fieldOptions = useMemo(() => {
    // For Spans dataset, use span-specific options from the provider
    if (dataset === DetectorDataset.SPANS || dataset === DetectorDataset.LOGS) {
      const spanColumnOptions: Array<[string, string]> = [
        ...Object.values(stringSpanTags).map((tag): [string, string] => [
          tag.key,
          prettifyTagKey(tag.name),
        ]),
        ...Object.values(numericSpanTags).map((tag): [string, string] => [
          tag.key,
          prettifyTagKey(tag.name),
        ]),
      ];
      return spanColumnOptions.sort((a, b) => a[1].localeCompare(b[1]));
    }

    // For other datasets, use the table field options
    return Object.values(aggregateOptions)
      .filter(
        option =>
          option.value.kind !== 'function' && // Exclude functions for field selection
          option.value.kind !== 'equation' // Exclude equations
      )
      .map((option): [string, string] => [option.value.meta.name, option.value.meta.name])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [dataset, stringSpanTags, numericSpanTags, aggregateOptions]);

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

  const hasVisibleParameters =
    Boolean(aggregateMetadata?.parameters?.length) &&
    dataset !== DetectorDataset.SPANS &&
    dataset !== DetectorDataset.LOGS;

  return (
    <AggregateContainer hasParameters={hasVisibleParameters}>
      <Flex gap={space(1)} align="flex-end">
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
            triggerLabel={aggregate || t('Select aggregate')}
            options={aggregateDropdownOptions}
            value={aggregate}
            onChange={option => {
              handleAggregateChange(String(option.value));
            }}
          />
        </FieldContainer>
        {aggregateMetadata?.parameters?.map((param, index) => {
          return (
            <FieldContainer key={index}>
              {param.kind === 'column' ? (
                <StyledVisualizeSelect
                  searchable
                  triggerLabel={
                    parameters[index] || param.defaultValue || t('Select metric')
                  }
                  options={fieldOptionsDropdown}
                  value={parameters[index] || param.defaultValue || ''}
                  onChange={option => {
                    handleParameterChange(index, String(option.value));
                  }}
                />
              ) : param.kind === 'dropdown' && param.options ? (
                <StyledVisualizeSelect
                  searchable
                  triggerLabel={
                    parameters[index] || param.defaultValue || t('Select value')
                  }
                  options={param.options.map(option => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  value={parameters[index] || param.defaultValue || ''}
                  onChange={option => {
                    handleParameterChange(index, String(option.value));
                  }}
                />
              ) : (
                <StyledParameterInput
                  placeholder={param.defaultValue || t('Enter value')}
                  value={parameters[index] || ''}
                  onChange={e => {
                    handleParameterChange(index, e.target.value);
                  }}
                />
              )}
            </FieldContainer>
          );
        })}
      </Flex>

      {/* Only show filter inline when no additional parameters */}
      {!hasVisibleParameters && (
        <Flex flex={1} gap={space(1)}>
          <DetectorQueryFilterBuilder />
        </Flex>
      )}

      {/* Show filter on separate row when parameters are visible */}
      {hasVisibleParameters && (
        <Flex flex={1} gap={space(1)}>
          <DetectorQueryFilterBuilder />
        </Flex>
      )}
    </AggregateContainer>
  );
}

const AggregateContainer = styled('div')<{hasParameters: boolean}>`
  display: grid;
  grid-template-columns: ${p => (p.hasParameters ? '1fr' : '1fr 2fr')};
  grid-template-rows: ${p => (p.hasParameters ? 'auto auto' : 'auto')};
  align-items: start;
  gap: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
`;

const FieldContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;
`;

const StyledAggregateSelect = styled(CompactSelect)`
  width: 100%;
  & > button {
    width: 100%;
    font-weight: normal;
  }
`;

const StyledVisualizeSelect = styled(CompactSelect)`
  width: 100%;
  & > button {
    width: 100%;
    font-weight: normal;
  }
`;

const StyledParameterInput = styled(Input)`
  flex: 1;
`;
