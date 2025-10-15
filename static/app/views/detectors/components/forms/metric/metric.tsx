import {useContext, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {RadioOption} from 'sentry/components/forms/controls/radioGroup';
import NumberField from 'sentry/components/forms/fields/numberField';
import SegmentedRadioField from 'sentry/components/forms/fields/segmentedRadioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import FormContext from 'sentry/components/forms/formContext';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  Detector,
  MetricDetector,
  MetricDetectorConfig,
} from 'sentry/types/workflowEngine/detectors';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
} from 'sentry/views/alerts/rules/metric/types';
import {hasLogAlerts} from 'sentry/views/alerts/wizard/utils';
import {TransactionsDatasetWarning} from 'sentry/views/detectors/components/details/metric/transactionsDatasetWarning';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  metricDetectorFormDataToEndpointPayload,
  metricSavedDetectorToFormData,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {MetricDetectorPreviewChart} from 'sentry/views/detectors/components/forms/metric/previewChart';
import {ResolveSection} from 'sentry/views/detectors/components/forms/metric/resolveSection';
import {useInitialMetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/useInitialMetricDetectorFormData';
import {useIntervalChoices} from 'sentry/views/detectors/components/forms/metric/useIntervalChoices';
import {Visualize} from 'sentry/views/detectors/components/forms/metric/visualize';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {getStaticDetectorThresholdSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {deprecateTransactionAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';

function MetricDetectorForm() {
  return (
    <FormStack>
      <TransactionsDatasetWarningListener />
      <DetectSection />
      <PrioritizeSection />
      <ResolveSection />
      <AssignSection />
      <AutomateSection />
    </FormStack>
  );
}

export function EditExistingMetricDetectorForm({detector}: {detector: Detector}) {
  return (
    <EditDetectorLayout
      detector={detector}
      previewChart={<MetricDetectorPreviewChart />}
      formDataToEndpointPayload={metricDetectorFormDataToEndpointPayload}
      savedDetectorToFormData={metricSavedDetectorToFormData}
      mapFormErrors={mapMetricDetectorFormErrors}
    >
      <MetricDetectorForm />
    </EditDetectorLayout>
  );
}

export function NewMetricDetectorForm() {
  const initialMetricFormData = useInitialMetricDetectorFormData();

  return (
    <NewDetectorLayout
      detectorType="metric_issue"
      previewChart={<MetricDetectorPreviewChart />}
      formDataToEndpointPayload={metricDetectorFormDataToEndpointPayload}
      initialFormData={initialMetricFormData}
      mapFormErrors={mapMetricDetectorFormErrors}
    >
      <MetricDetectorForm />
    </NewDetectorLayout>
  );
}

// Errors come back as nested objects, we need to flatten them
// to match the form state
const mapMetricDetectorFormErrors = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return error;
  }

  if ('dataSource' in error && typeof error.dataSource === 'object') {
    return {
      ...error,
      ...error.dataSource,
    };
  }
  return error;
};

const DETECTION_TYPE_MAP: Record<
  MetricDetectorConfig['detectionType'],
  {description: string; label: string}
> = {
  static: {
    label: t('Threshold'),
    description: t('Absolute-valued thresholds, for non-seasonal data.'),
  },
  percent: {
    label: t('Change'),
    description: t('Percentage changes over defined time windows.'),
  },
  dynamic: {
    label: t('Dynamic'),
    description: t('Auto-detect anomalies and mean deviation, for seasonal/noisy data.'),
  },
};

function DetectionType() {
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const datasetConfig = getDatasetConfig(dataset);
  const options: RadioOption[] = datasetConfig.supportedDetectionTypes.map(
    detectionType => [
      detectionType,
      DETECTION_TYPE_MAP[detectionType].label,
      DETECTION_TYPE_MAP[detectionType].description,
    ]
  );

  return (
    <DetectionTypeField
      label={t('\u2026and monitor for changes in the following way:')}
      flexibleControlStateSize
      inline={false}
      name={METRIC_DETECTOR_FORM_FIELDS.detectionType}
      defaultValue="threshold"
      choices={options}
      preserveOnUnmount
    />
  );
}

function PrioritizeSection() {
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  return (
    <Container>
      <Section
        title={t('Prioritize')}
        description={
          detectionType === 'dynamic'
            ? t('Sentry will automatically update priority.')
            : t('Update issue priority when the following thresholds are met:')
        }
      >
        {detectionType !== 'dynamic' && (
          <PriorityControl minimumPriority={DetectorPriorityLevel.MEDIUM} />
        )}
      </Section>
    </Container>
  );
}

function IntervalPicker() {
  const formContext = useContext(FormContext);
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const interval = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.interval);
  const intervalChoices = useIntervalChoices({dataset, detectionType});

  useEffect(() => {
    if (!intervalChoices.some(choice => choice[0] === interval)) {
      formContext.form?.setValue(
        METRIC_DETECTOR_FORM_FIELDS.interval,
        intervalChoices[0]![0]
      );
    }
  }, [intervalChoices, formContext.form, interval, dataset]);

  return (
    <IntervalField
      placeholder={t('Interval')}
      flexibleControlStateSize
      inline={false}
      label={
        <Tooltip
          title={t('The time period over which to evaluate your metric.')}
          showUnderline
        >
          <SectionLabel>{t('Interval')}</SectionLabel>
        </Tooltip>
      }
      name={METRIC_DETECTOR_FORM_FIELDS.interval}
      choices={intervalChoices}
    />
  );
}

function useDatasetChoices() {
  const organization = useOrganization();

  const {detector} = useDetectorFormContext();
  const savedDataset = (detector as MetricDetector | undefined)?.dataSources[0]?.queryObj
    ?.snubaQuery?.dataset;
  const isExistingTransactionsDetector =
    Boolean(detector) &&
    [Dataset.TRANSACTIONS, Dataset.GENERIC_METRICS].includes(savedDataset as Dataset);
  const shouldHideTransactionsDataset =
    !isExistingTransactionsDetector && deprecateTransactionAlerts(organization);

  return useMemo(() => {
    const datasetChoices: Array<SelectValue<DetectorDataset>> = [
      {
        value: DetectorDataset.ERRORS,
        label: t('Errors'),
      },
      ...(shouldHideTransactionsDataset
        ? []
        : [
            {
              value: DetectorDataset.TRANSACTIONS,
              label: t('Transactions'),
            },
          ]),
      ...(organization.features.includes('visibility-explore-view')
        ? [{value: DetectorDataset.SPANS, label: t('Spans')}]
        : []),
      ...(hasLogAlerts(organization)
        ? [
            {
              value: DetectorDataset.LOGS,
              label: t('Logs'),
              trailingItems: <FeatureBadge type="new" />,
            },
          ]
        : []),
      {value: DetectorDataset.RELEASES, label: t('Releases')},
    ];

    return datasetChoices;
  }, [organization, shouldHideTransactionsDataset]);
}

function DetectSection() {
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const datasetChoices = useDatasetChoices();
  const formContext = useContext(FormContext);
  const aggregate = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );

  return (
    <Container>
      <Section
        title={t('Detect')}
        description={t('Sentry will check the following query:')}
      >
        <DatasetRow>
          <DatasetField
            placeholder={t('Dataset')}
            flexibleControlStateSize
            inline={false}
            label={
              <Tooltip
                title={t('This reflects the type of information you want to use.')}
                showUnderline
              >
                <SectionLabel>{t('Dataset')}</SectionLabel>
              </Tooltip>
            }
            name={METRIC_DETECTOR_FORM_FIELDS.dataset}
            options={datasetChoices}
            onChange={newDataset => {
              // Reset aggregate function to dataset default when dataset changes
              const datasetConfig = getDatasetConfig(newDataset);
              const defaultAggregate = generateFieldAsString(datasetConfig.defaultField);
              formContext.form?.setValue(
                METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
                defaultAggregate
              );

              const supportedDetectionTypes = datasetConfig.supportedDetectionTypes;
              if (!supportedDetectionTypes.includes(detectionType)) {
                formContext.form?.setValue(
                  METRIC_DETECTOR_FORM_FIELDS.detectionType,
                  supportedDetectionTypes[0]
                );
              }
            }}
          />
          <IntervalPicker />
        </DatasetRow>
        <Visualize />
        <DetectionType />
        <Flex direction="column">
          {(!detectionType || detectionType === 'static') && (
            <Flex direction="column">
              <MutedText>{t('An issue will be created when query value is:')}</MutedText>
              <Flex align="center" gap="md">
                <DirectionField
                  aria-label={t('Threshold direction')}
                  name={METRIC_DETECTOR_FORM_FIELDS.conditionType}
                  hideLabel
                  inline
                  flexibleControlStateSize
                  choices={
                    [
                      [DataConditionType.GREATER, t('Above')],
                      [DataConditionType.LESS, t('Below')],
                    ] satisfies Array<[MetricDetectorFormData['conditionType'], string]>
                  }
                  required
                  preserveOnUnmount
                />
                <ThresholdField
                  aria-label={t('Threshold')}
                  flexibleControlStateSize
                  inline={false}
                  hideLabel
                  placeholder="0"
                  name={METRIC_DETECTOR_FORM_FIELDS.conditionValue}
                  suffix={getStaticDetectorThresholdSuffix(aggregate)}
                  required
                  preserveOnUnmount
                />
              </Flex>
            </Flex>
          )}
          {detectionType === 'percent' && (
            <Flex direction="column">
              <MutedText>{t('An issue will be created when query value is:')}</MutedText>
              <Flex align="center" gap="md">
                <ChangePercentField
                  name={METRIC_DETECTOR_FORM_FIELDS.conditionValue}
                  aria-label={t('Initial threshold')}
                  placeholder="0"
                  hideLabel
                  inline
                  required
                  preserveOnUnmount
                />
                <span>{t('percent')}</span>
                <DirectionField
                  name={METRIC_DETECTOR_FORM_FIELDS.conditionType}
                  hideLabel
                  inline
                  flexibleControlStateSize
                  choices={
                    [
                      [DataConditionType.GREATER, t('higher')],
                      [DataConditionType.LESS, t('lower')],
                    ] satisfies Array<[MetricDetectorFormData['conditionType'], string]>
                  }
                  required
                  preserveOnUnmount
                />
                <span>{t('than the previous')}</span>
                <StyledSelectField
                  name={METRIC_DETECTOR_FORM_FIELDS.conditionComparisonAgo}
                  hideLabel
                  inline
                  flexibleControlStateSize
                  choices={
                    [
                      [5 * 60, '5 minutes'],
                      [15 * 60, '15 minutes'],
                      [60 * 60, '1 hour'],
                      [24 * 60 * 60, '1 day'],
                      [7 * 24 * 60 * 60, '1 week'],
                      [30 * 24 * 60 * 60, '1 month'],
                    ] satisfies Array<
                      [MetricDetectorFormData['conditionComparisonAgo'], string]
                    >
                  }
                  preserveOnUnmount
                  required
                />
              </Flex>
            </Flex>
          )}
          {detectionType === 'dynamic' && (
            <Flex direction="column">
              <SelectField
                required
                name={METRIC_DETECTOR_FORM_FIELDS.sensitivity}
                label={t('Level of responsiveness')}
                help={t(
                  'Choose your level of anomaly responsiveness. Higher thresholds means alerts for most anomalies. Lower thresholds means alerts only for larger ones.'
                )}
                choices={
                  [
                    [AlertRuleSensitivity.HIGH, t('High')],
                    [AlertRuleSensitivity.MEDIUM, t('Medium')],
                    [AlertRuleSensitivity.LOW, t('Low')],
                  ] satisfies Array<[MetricDetectorFormData['sensitivity'], string]>
                }
                preserveOnUnmount
              />
              <SelectField
                required
                name={METRIC_DETECTOR_FORM_FIELDS.thresholdType}
                label={t('Direction of anomaly movement')}
                help={t(
                  'Decide if you want to be alerted to anomalies that are moving above, below, or in both directions in relation to your threshold.'
                )}
                choices={
                  [
                    [AlertRuleThresholdType.ABOVE, t('Above')],
                    [AlertRuleThresholdType.ABOVE_AND_BELOW, t('Above and Below')],
                    [AlertRuleThresholdType.BELOW, t('Below')],
                  ] satisfies Array<[MetricDetectorFormData['thresholdType'], string]>
                }
                preserveOnUnmount
              />
            </Flex>
          )}
        </Flex>
      </Section>
    </Container>
  );
}

function TransactionsDatasetWarningListener() {
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  if (dataset !== DetectorDataset.TRANSACTIONS) {
    return null;
  }

  return <TransactionsDatasetWarning />;
}

const FormStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  max-width: ${p => p.theme.breakpoints.xl};
`;

const DatasetRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1)};
  max-width: 475px;
`;

const StyledSelectField = styled(SelectField)`
  width: 180px;
  padding: 0;
  margin: 0;

  > div {
    padding-left: 0;
  }
`;

const DirectionField = styled(SelectField)`
  width: 16ch;
  padding: 0;
  margin: 0;
  border-bottom: none;

  > div {
    padding-left: 0;
  }
`;

const DetectionTypeField = styled(SegmentedRadioField)`
  padding-left: 0;
  padding-block: ${space(1)};
  border-bottom: none;
  max-width: 840px;

  > div {
    padding: 0;
  }
`;

const ThresholdField = styled(NumberField)`
  padding: 0;
  margin: 0;
  border: none;

  > div {
    padding: 0;
    width: 18ch;
  }
`;

const ChangePercentField = styled(NumberField)`
  padding: 0;
  margin: 0;
  border: none;

  > div {
    padding: 0;
    max-width: 10ch;
  }
`;

const MutedText = styled('p')`
  color: ${p => p.theme.text};
  padding-top: ${space(1)};
  margin-bottom: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
`;

const DatasetField = styled(SelectField)`
  flex: 1;
  padding: 0;
  margin-left: 0;
  border-bottom: none;
`;

const IntervalField = styled(SelectField)`
  flex: 1;
  padding: 0;
  margin-left: 0;
  border-bottom: none;
`;
