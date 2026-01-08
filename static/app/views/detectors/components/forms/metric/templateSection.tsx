import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import FormContext from 'sentry/components/forms/formContext';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import type {MetricAlertType} from 'sentry/views/alerts/wizard/options';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {METRIC_TEMPLATE_OPTIONS} from 'sentry/views/detectors/components/forms/metric/metricTemplateOptions';
import {sanitizeDetectorQuery} from 'sentry/views/detectors/components/forms/metric/sanitizeDetectorQuery';
import {useDatasetChoices} from 'sentry/views/detectors/components/forms/metric/useDatasetChoices';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

const DATASET_LABELS: Record<DetectorDataset, string> = {
  [DetectorDataset.ERRORS]: t('Errors'),
  [DetectorDataset.SPANS]: t('Spans'),
  [DetectorDataset.LOGS]: t('Logs'),
  [DetectorDataset.RELEASES]: t('Releases'),
  [DetectorDataset.TRANSACTIONS]: t('Transactions'),
};

/**
 * Value used to indicate a custom template (not matching any predefined template)
 */
const CUSTOM_TEMPLATE_VALUE = '__custom__' as const;

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

  // Filter templates to allowed datasets
  const templateMetaByKey = useMemo(() => {
    const filtered = METRIC_TEMPLATE_OPTIONS.filter(opt =>
      allowedDatasets.has(opt.detectorDataset)
    );
    return Object.fromEntries(filtered.map(m => [m.key, m]));
  }, [allowedDatasets]);

  // Build template options grouped by dataset into sections
  const templateOptions = useMemo(() => {
    // Group templates by dataset
    const templatesByDataset = Object.groupBy(
      Object.values(templateMetaByKey),
      opt => opt.detectorDataset
    );

    // Convert to sections
    return Object.entries(templatesByDataset)
      .filter(([, templates]) => templates && templates.length > 0)
      .map(([dataset, templates]) => ({
        key: dataset as DetectorDataset,
        label: DATASET_LABELS[dataset as DetectorDataset] ?? dataset,
        options: templates.map(opt => ({
          label: opt.label,
          value: opt.key,
        })),
      }));
  }, [templateMetaByKey]);

  // Derive current template value based on form state
  const currentTemplateValue = useMemo(() => {
    if (!currentDataset || !currentAggregateFunction) {
      return CUSTOM_TEMPLATE_VALUE;
    }

    // Find first matching template
    const matchingTemplate = Object.entries(templateMetaByKey).find(([, meta]) => {
      // Match dataset
      if (meta.detectorDataset !== currentDataset) {
        return false;
      }

      // Match aggregate - convert template's API aggregate to UI format for comparison
      const datasetConfig = getDatasetConfig(meta.detectorDataset);
      const templateUiAggregate = datasetConfig.fromApiAggregate(meta.aggregate);
      return templateUiAggregate === currentAggregateFunction;
    });

    return matchingTemplate
      ? (matchingTemplate[0] as MetricAlertType)
      : CUSTOM_TEMPLATE_VALUE;
  }, [currentDataset, currentAggregateFunction, templateMetaByKey]);

  // Get the label for the current selected template
  const selectedOptionLabel = useMemo(() => {
    if (currentTemplateValue === CUSTOM_TEMPLATE_VALUE) {
      return t('Custom');
    }
    return (
      templateMetaByKey[currentTemplateValue]?.label ?? t('Choose a template (optional)')
    );
  }, [currentTemplateValue, templateMetaByKey]);

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
          trigger={triggerProps => {
            return (
              <StyledTriggerButton
                {...triggerProps}
                data-test-id="template-selector"
                aria-label={selectedOptionLabel || t('Choose a template (optional)')}
              >
                {selectedOptionLabel}
              </StyledTriggerButton>
            );
          }}
          onChange={option => {
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
            const newQuery = currentQuery
              ? sanitizeDetectorQuery({
                  dataset: meta.detectorDataset,
                  query: currentQuery,
                })
              : (meta.query ?? '');
            formContext.form?.setValue(METRIC_DETECTOR_FORM_FIELDS.query, newQuery);
          }}
        />
      </Flex>
    </Container>
  );
}

const StyledTriggerButton = styled(SelectTrigger.Button)`
  min-width: 425px;
`;
