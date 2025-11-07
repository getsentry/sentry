import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import DropdownButton from 'sentry/components/dropdownButton';
import FormContext from 'sentry/components/forms/formContext';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';
import type {MetricAlertType} from 'sentry/views/alerts/wizard/options';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useDatasetChoices} from 'sentry/views/detectors/components/forms/metric/useDatasetChoices';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

interface TemplateOption {
  aggregate: string;
  detectorDataset: DetectorDataset;
  key: MetricAlertType;
  label: string;
  query: string;
}

/**
 * Template options for metric detectors.
 * These define the available metric templates that users can select.
 */
const METRIC_TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    key: 'num_errors',
    label: t('Number of Errors'),
    detectorDataset: DetectorDataset.ERRORS,
    aggregate: 'count()',
    query: '',
  },
  {
    key: 'users_experiencing_errors',
    label: t('Users Experiencing Errors'),
    detectorDataset: DetectorDataset.ERRORS,
    aggregate: 'count_unique(user)',
    query: '',
  },
  {
    key: 'trace_item_throughput',
    label: t('Throughput'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'count(span.duration)',
    query: '',
  },
  {
    key: 'trace_item_duration',
    label: t('Duration'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'p95(span.duration)',
    query: '',
  },
  {
    key: 'trace_item_failure_rate',
    label: t('Failure Rate'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'failure_rate()',
    query: '',
  },
  {
    key: 'trace_item_lcp',
    label: t('Largest Contentful Paint'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'p95(measurements.lcp)',
    query: '',
  },
  {
    key: 'trace_item_logs',
    label: t('Logs'),
    detectorDataset: DetectorDataset.LOGS,
    aggregate: 'count(message)',
    query: '',
  },
  {
    key: 'crash_free_sessions',
    label: t('Crash Free Session Rate'),
    detectorDataset: DetectorDataset.RELEASES,
    aggregate: SessionsAggregate.CRASH_FREE_SESSIONS,
    query: '',
  },
  {
    key: 'crash_free_users',
    label: t('Crash Free User Rate'),
    detectorDataset: DetectorDataset.RELEASES,
    aggregate: SessionsAggregate.CRASH_FREE_USERS,
    query: '',
  },
];

export function TemplateSection() {
  const formContext = useContext(FormContext);
  const datasetChoices = useDatasetChoices();
  const allowedDatasets = useMemo(
    () => new Set(datasetChoices.map(choice => choice.value)),
    [datasetChoices]
  );

  const currentDataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const currentAggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const currentQuery = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);

  // Build template options grouped by dataset into sections
  const templateOptions = useMemo(() => {
    // Group templates by dataset
    const templatesByDataset = METRIC_TEMPLATE_OPTIONS.reduce(
      (acc, opt) => {
        if (!allowedDatasets.has(opt.detectorDataset)) {
          return acc;
        }
        if (!acc[opt.detectorDataset]) {
          acc[opt.detectorDataset] = [];
        }
        acc[opt.detectorDataset].push(opt);
        return acc;
      },
      {} as Record<DetectorDataset, TemplateOption[]>
    );

    // Convert to sections
    const sections: Array<{
      key: DetectorDataset;
      label: string;
      options: Array<{label: string; value: MetricAlertType}>;
    }> = [];

    // Dataset labels mapping
    const datasetLabels: Record<DetectorDataset, string> = {
      [DetectorDataset.ERRORS]: t('Errors'),
      [DetectorDataset.SPANS]: t('Spans'),
      [DetectorDataset.LOGS]: t('Logs'),
      [DetectorDataset.RELEASES]: t('Releases'),
      [DetectorDataset.TRANSACTIONS]: t('Transactions'),
    };

    // Create sections for each dataset that has templates
    for (const [dataset, templates] of Object.entries(templatesByDataset)) {
      if (templates.length > 0) {
        sections.push({
          key: dataset as DetectorDataset,
          label: datasetLabels[dataset as DetectorDataset] ?? dataset,
          options: templates.map(opt => ({
            label: opt.label,
            value: opt.key,
          })),
        });
      }
    }

    return sections;
  }, [allowedDatasets]);

  const templateMetaByKey = useMemo(() => {
    const filtered = METRIC_TEMPLATE_OPTIONS.filter(opt =>
      allowedDatasets.has(opt.detectorDataset)
    );
    return Object.fromEntries(filtered.map(m => [m.key, m]));
  }, [allowedDatasets]);

  // Derive current template value based on form state
  const currentTemplateValue = useMemo(() => {
    if (!currentDataset || !currentAggregateFunction) {
      return '__custom__' as const;
    }

    // Find all matching templates
    const matchingTemplates: Array<
      [MetricAlertType, (typeof templateMetaByKey)[string]]
    > = [];

    for (const [key, meta] of Object.entries(templateMetaByKey)) {
      // Match dataset
      if (meta.detectorDataset !== currentDataset) {
        continue;
      }

      // Match aggregate - convert template's API aggregate to UI format for comparison
      const datasetConfig = getDatasetConfig(meta.detectorDataset);
      const templateUiAggregate = datasetConfig.fromApiAggregate(meta.aggregate);
      if (templateUiAggregate !== currentAggregateFunction) {
        continue;
      }

      // Match query (normalize empty strings and undefined)
      const templateQuery = meta.query ?? '';
      const formQuery = currentQuery ?? '';
      if (templateQuery !== formQuery) {
        continue;
      }

      matchingTemplates.push([key as MetricAlertType, meta]);
    }

    // If multiple templates match (e.g., eap_metrics and trace_item_throughput),
    // prefer trace_item_throughput over eap_metrics
    if (matchingTemplates.length > 0) {
      // Sort to prefer trace_item_* templates over eap_metrics
      matchingTemplates.sort(([keyA], [keyB]) => {
        // Prefer trace_item_* templates
        const aIsTraceItem = keyA.startsWith('trace_item_');
        const bIsTraceItem = keyB.startsWith('trace_item_');
        if (aIsTraceItem && !bIsTraceItem) return -1;
        if (!aIsTraceItem && bIsTraceItem) return 1;

        // If both are trace_item_* or both are not, prefer the one that appears first in options
        // This ensures deterministic selection
        return 0;
      });

      return matchingTemplates[0]![0];
    }

    // No template matches, return "custom"
    return '__custom__' as const;
  }, [currentDataset, currentAggregateFunction, currentQuery, templateMetaByKey]);

  // Get the label for the current selected template
  const selectedOptionLabel = useMemo(() => {
    if (currentTemplateValue === '__custom__') {
      return t('Custom');
    }
    // Search through sections to find the selected option
    for (const section of templateOptions) {
      const selectedOption = section.options.find(
        opt => opt.value === currentTemplateValue
      );
      if (selectedOption) {
        return selectedOption.label;
      }
    }
    return t('Choose a template (optional)');
  }, [currentTemplateValue, templateOptions]);

  // No templates available, skip rendering
  if (!templateOptions.length) {
    return null;
  }

  return (
    <Container>
      <Flex direction="column" gap="xs">
        <Heading as="h3">{t('Choose Your Metric')}</Heading>
        <CompactSelect
          options={templateOptions}
          value={currentTemplateValue}
          disallowEmptySelection={false}
          trigger={(triggerProps, isOpen) => {
            return (
              <StyledTriggerButton
                isOpen={isOpen}
                {...triggerProps}
                data-test-id="template-selector"
                aria-label={selectedOptionLabel || t('Choose a template (optional)')}
              >
                {selectedOptionLabel}
              </StyledTriggerButton>
            );
          }}
          onChange={option => {
            if (!option) {
              return;
            }
            const key = option.value;

            const meta = templateMetaByKey[key as MetricAlertType];
            if (!meta) {
              return;
            }

            // Apply selected template values
            const datasetConfig = getDatasetConfig(meta.detectorDataset);
            const uiAggregate = datasetConfig.fromApiAggregate(meta.aggregate);
            formContext.form?.setValue(
              METRIC_DETECTOR_FORM_FIELDS.dataset,
              meta.detectorDataset
            );
            formContext.form?.setValue(
              METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
              uiAggregate
            );
            formContext.form?.setValue(METRIC_DETECTOR_FORM_FIELDS.query, meta.query);
          }}
        />
      </Flex>
    </Container>
  );
}

const StyledTriggerButton = styled(DropdownButton)`
  min-width: 425px;
`;
