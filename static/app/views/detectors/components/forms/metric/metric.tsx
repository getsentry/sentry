import {Fragment, useContext, useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import toNumber from 'lodash/toNumber';

import {Alert} from '@sentry/scraps/alert/alert';
import {ExternalLink, Link} from '@sentry/scraps/link/link';

import {Disclosure} from 'sentry/components/core/disclosure';
import {Flex, Stack} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';
import type {RadioOption} from 'sentry/components/forms/controls/radioGroup';
import NumberField from 'sentry/components/forms/fields/numberField';
import SegmentedRadioField from 'sentry/components/forms/fields/segmentedRadioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import FormContext from 'sentry/components/forms/formContext';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import {pulse} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector, MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
import {
  TRANSACTIONS_DATASET_DEPRECATION_MESSAGE,
  TransactionsDatasetWarning,
} from 'sentry/views/detectors/components/details/metric/transactionsDatasetWarning';
import {useIsMigratedExtrapolation} from 'sentry/views/detectors/components/details/metric/utils/useIsMigratedExtrapolation';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {DescribeSection} from 'sentry/views/detectors/components/forms/common/describeSection';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  metricDetectorFormDataToEndpointPayload,
  metricSavedDetectorToFormData,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {MetricDetectorPreviewChart} from 'sentry/views/detectors/components/forms/metric/previewChart';
import {DetectorQueryFilterBuilder} from 'sentry/views/detectors/components/forms/metric/queryFilterBuilder';
import {ResolveSection} from 'sentry/views/detectors/components/forms/metric/resolveSection';
import {sanitizeDetectorQuery} from 'sentry/views/detectors/components/forms/metric/sanitizeDetectorQuery';
import {TemplateSection} from 'sentry/views/detectors/components/forms/metric/templateSection';
import {useAutoMetricDetectorName} from 'sentry/views/detectors/components/forms/metric/useAutoMetricDetectorName';
import {useDatasetChoices} from 'sentry/views/detectors/components/forms/metric/useDatasetChoices';
import {useInitialMetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/useInitialMetricDetectorFormData';
import {useIntervalChoices} from 'sentry/views/detectors/components/forms/metric/useIntervalChoices';
import {Visualize} from 'sentry/views/detectors/components/forms/metric/visualize';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {PriorityDot} from 'sentry/views/detectors/components/priorityDot';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

function MetricDetectorForm() {
  useAutoMetricDetectorName();
  const theme = useTheme();

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.xl}>
      <TransactionsDatasetWarningListener />
      <MigratedAlertWarningListener />
      <TemplateSection />
      <CustomizeMetricSection />
      <DetectSection />
      <AssignSection />
      <DescribeSection />
      <AutomateSection />
    </Stack>
  );
}

export function EditExistingMetricDetectorForm({detector}: {detector: Detector}) {
  const metricDetector = detector.type === 'metric_issue' ? detector : undefined;

  return (
    <EditDetectorLayout
      detector={detector}
      previewChart={<MetricDetectorPreviewChart detector={metricDetector} />}
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
      flexibleControlStateSize
      inline={false}
      name={METRIC_DETECTOR_FORM_FIELDS.detectionType}
      defaultValue="threshold"
      choices={options}
      preserveOnUnmount
    />
  );
}

function validateMediumThreshold({
  form,
}: {
  form: MetricDetectorFormData;
  id: string;
}): Array<[string, string]> {
  const mediumNum = toNumber(form.mediumThreshold);
  const highNum = toNumber(form.highThreshold);
  const {conditionType} = form;

  if (!conditionType || !form.mediumThreshold || form.mediumThreshold === '') {
    return [];
  }

  if (!Number.isFinite(mediumNum) || !Number.isFinite(highNum)) {
    return [];
  }

  // For GREATER: medium should be lower than high
  // For LESS: medium should be higher than high
  const isValid =
    conditionType === DataConditionType.GREATER
      ? mediumNum < highNum
      : mediumNum > highNum;

  if (!isValid) {
    const message =
      conditionType === DataConditionType.GREATER
        ? t('Medium threshold must be lower than high threshold (%s)', String(highNum))
        : t('Medium threshold must be higher than high threshold (%s)', String(highNum));
    return [[METRIC_DETECTOR_FORM_FIELDS.mediumThreshold, message]];
  }

  return [];
}

interface PriorityRowProps {
  aggregate: string;
  detectionType: 'static' | 'percent';
  priority: PriorityLevel;
  showComparisonAgo?: boolean;
}

function PriorityRow({
  priority,
  detectionType,
  aggregate,
  showComparisonAgo,
}: PriorityRowProps) {
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const thresholdSuffix = getMetricDetectorSuffix(detectionType, aggregate);
  const isHigh = priority === 'high';
  const isStatic = detectionType === 'static';

  const conditionChoices: Array<[MetricDetectorFormData['conditionType'], string]> =
    isStatic
      ? [
          [DataConditionType.GREATER, t('Above')],
          [DataConditionType.LESS, t('Below')],
        ]
      : [
          [DataConditionType.GREATER, t('higher')],
          [DataConditionType.LESS, t('lower')],
        ];

  const thresholdFieldName = isHigh
    ? METRIC_DETECTOR_FORM_FIELDS.highThreshold
    : METRIC_DETECTOR_FORM_FIELDS.mediumThreshold;

  const thresholdAriaLabel = isHigh ? t('High threshold') : t('Medium threshold');

  const directionField = isHigh ? (
    <DirectionField
      aria-label={t('Threshold direction')}
      name={METRIC_DETECTOR_FORM_FIELDS.conditionType}
      hideLabel
      inline
      flexibleControlStateSize
      choices={conditionChoices}
      required
      preserveOnUnmount
    />
  ) : (
    <DirectionField
      key={conditionType}
      aria-label={t('Threshold direction')}
      name="conditionTypeDisplay"
      hideLabel
      inline
      flexibleControlStateSize
      choices={conditionChoices}
      defaultValue={conditionType}
      disabled
    />
  );

  return (
    <PriorityRowContainer>
      <PriorityDot priority={priority} />
      <PriorityLabel>
        {isHigh ? t('High priority') : t('Medium priority')}
        {isHigh && <RequiredAsterisk>*</RequiredAsterisk>}
      </PriorityLabel>
      <Flex align="center" gap="md">
        {isStatic ? (
          <Fragment>
            {directionField}
            <ThresholdField
              aria-label={thresholdAriaLabel}
              flexibleControlStateSize
              inline={false}
              hideLabel
              placeholder="0"
              name={thresholdFieldName}
              suffix={thresholdSuffix}
              required={isHigh}
              validate={isHigh ? undefined : validateMediumThreshold}
              preserveOnUnmount
            />
          </Fragment>
        ) : (
          <Fragment>
            <ChangePercentField
              name={thresholdFieldName}
              aria-label={thresholdAriaLabel}
              placeholder="0"
              suffix="%"
              hideLabel
              inline
              required={isHigh}
              validate={isHigh ? undefined : validateMediumThreshold}
              preserveOnUnmount
            />
            {directionField}
          </Fragment>
        )}
        {showComparisonAgo && (
          <Fragment>
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
          </Fragment>
        )}
      </Flex>
    </PriorityRowContainer>
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
      preserveOnUnmount
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
      disabled={dataset === DetectorDataset.TRANSACTIONS}
    />
  );
}

function CustomizeMetricSection() {
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const datasetChoices = useDatasetChoices();
  const formContext = useContext(FormContext);
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const query = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  const isTransactionsDataset = dataset === DetectorDataset.TRANSACTIONS;

  return (
    <Container>
      <Disclosure as="section" size="md" role="region" defaultExpanded>
        <Disclosure.Title aria-label={t('Customize Metric Section')}>
          <Text size="lg">{t('Customize Metric')}</Text>
        </Disclosure.Title>
        <Disclosure.Content>
          <Flex direction="column" gap="md">
            <Flex direction="column" gap="xs">
              <DatasetRow>
                <DatasetField
                  placeholder={t('Dataset')}
                  flexibleControlStateSize
                  inline={false}
                  preserveOnUnmount
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
                    const defaultAggregate = generateFieldAsString(
                      datasetConfig.defaultField
                    );
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

                    const sanitizedQuery = sanitizeDetectorQuery({
                      dataset: newDataset,
                      query,
                    });
                    if (sanitizedQuery !== query) {
                      formContext.form?.setValue(
                        METRIC_DETECTOR_FORM_FIELDS.query,
                        sanitizedQuery
                      );
                    }
                  }}
                />
                <Tooltip
                  title={TRANSACTIONS_DATASET_DEPRECATION_MESSAGE}
                  isHoverable
                  disabled={!isTransactionsDataset}
                >
                  <DisabledSection disabled={isTransactionsDataset}>
                    <IntervalPicker />
                  </DisabledSection>
                </Tooltip>
              </DatasetRow>
            </Flex>
            <Tooltip
              title={TRANSACTIONS_DATASET_DEPRECATION_MESSAGE}
              isHoverable
              disabled={!isTransactionsDataset}
            >
              <DisabledSection disabled={isTransactionsDataset}>
                <Visualize />
              </DisabledSection>
            </Tooltip>
            <Tooltip
              title={TRANSACTIONS_DATASET_DEPRECATION_MESSAGE}
              isHoverable
              disabled={!isTransactionsDataset}
            >
              <FilterRow disabled={isTransactionsDataset}>
                <DetectorQueryFilterBuilder />
              </FilterRow>
            </Tooltip>
          </Flex>
        </Disclosure.Content>
      </Disclosure>
    </Container>
  );
}

function DetectSection() {
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const aggregate = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const extrapolationMode = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.extrapolationMode
  );

  const showThresholdWarning = useIsMigratedExtrapolation({
    dataset,
    extrapolationMode,
  });

  return (
    <Container>
      <Flex direction="column" gap="lg">
        <div>
          <HeadingContainer>
            <Heading as="h3">{t('Issue Detection')}</Heading>
            {showThresholdWarning && (
              <WarningIcon
                id="thresholds-warning-icon"
                tooltipProps={{
                  isHoverable: true,
                  title: tct(
                    'Your thresholds may need to be adjusted to take into account [samplingLink:sampling].',
                    {
                      samplingLink: (
                        <ExternalLink
                          href="https://docs.sentry.io/product/explore/trace-explorer/#how-sampling-affects-queries-in-trace-explorer"
                          openInNewTab
                        />
                      ),
                    }
                  ),
                }}
              />
            )}
          </HeadingContainer>
          <DetectionType />
          <Flex direction="column">
            {(!detectionType || detectionType === 'static') && (
              <Flex direction="column">
                <DefineThresholdParagraph>
                  <Text bold>{t('Define threshold & set priority')}</Text>
                  <Text variant="muted">
                    {t('An issue will be created when query value is:')}
                  </Text>
                </DefineThresholdParagraph>
                <PriorityRowsContainer>
                  <PriorityRow
                    priority={PriorityLevel.HIGH}
                    detectionType="static"
                    aggregate={aggregate}
                  />
                  <PriorityRow
                    priority={PriorityLevel.MEDIUM}
                    detectionType="static"
                    aggregate={aggregate}
                  />
                </PriorityRowsContainer>
              </Flex>
            )}
            {detectionType === 'percent' && (
              <Flex direction="column">
                <DefineThresholdParagraph>
                  <Text bold>{t('Define threshold & set priority')}</Text>
                  <Text variant="muted">
                    {t('An issue will be created when query value is:')}
                  </Text>
                </DefineThresholdParagraph>
                <PriorityRowsContainer>
                  <PriorityRow
                    priority={PriorityLevel.HIGH}
                    detectionType="percent"
                    aggregate={aggregate}
                    showComparisonAgo
                  />
                  <PriorityRow
                    priority={PriorityLevel.MEDIUM}
                    detectionType="percent"
                    aggregate={aggregate}
                  />
                </PriorityRowsContainer>
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
        </div>
        {detectionType !== 'dynamic' && (
          <Fragment>
            <DefineThresholdParagraph>
              <Text bold>{t('Resolve')}</Text>
            </DefineThresholdParagraph>
            <ResolveSection />
          </Fragment>
        )}
      </Flex>
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

function MigratedAlertWarningListener() {
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const extrapolationMode = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.extrapolationMode
  );
  const isMigratedExtrapolation = useIsMigratedExtrapolation({
    dataset,
    extrapolationMode,
  });
  const location = useLocation();

  if (isMigratedExtrapolation) {
    return (
      <Alert.Container>
        <Alert variant="info">
          {tct(
            'The thresholds on this chart may look off. This is because, once saved, alerts will now take into account [samplingLink:sampling rate]. Before clicking save, take the time to update your [thresholdsLink:thresholds]. Cancel to continue running this alert in compatibility mode.',
            {
              samplingLink: (
                <ExternalLink
                  href="https://docs.sentry.io/product/explore/trace-explorer/#how-sampling-affects-queries-in-trace-explorer"
                  openInNewTab
                />
              ),
              thresholdsLink: (
                <Link
                  aria-label="Go to thresholds"
                  preventScrollReset
                  to={{...location, hash: '#thresholds-warning-icon'}}
                  onClick={() => {
                    requestAnimationFrame(() => {
                      document
                        .getElementById('thresholds-warning-icon')
                        ?.scrollIntoView({behavior: 'smooth'});
                    });
                  }}
                />
              ),
            }
          )}
        </Alert>
      </Alert.Container>
    );
  }

  return null;
}

function WarningIcon({id, tooltipProps}: {id: string; tooltipProps?: TooltipProps}) {
  return (
    <Tooltip title={tooltipProps?.title} skipWrapper {...tooltipProps}>
      <StyledIconWarning id={id} size="md" color="yellow300" />
    </Tooltip>
  );
}

const StyledIconWarning = styled(IconWarning)`
  animation: ${() => pulse(1.15)} 1s ease infinite;
`;

const HeadingContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const DatasetRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
  max-width: 425px;
`;

const FilterRow = styled('div')<{disabled: boolean}>`
  ${p => (p.disabled ? `opacity: 0.6;` : '')}
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

const DefineThresholdParagraph = styled('p')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  flex-direction: column;
  margin-bottom: ${p => p.theme.space.sm};
  padding-top: ${p => p.theme.space.lg};
  margin-top: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.border};
`;

const DatasetField = styled(SelectField)`
  flex: 1;
  padding: 0;
  margin-left: 0;
  border-bottom: none;
  max-width: 225px;
`;

const IntervalField = styled(SelectField)`
  flex: 1;
  padding: 0;
  margin-left: 0;
  border-bottom: none;
  max-width: 225px;
`;

const DisabledSection = styled('div')<{disabled: boolean}>`
  ${p => (p.disabled ? `opacity: 0.6;` : '')}
`;

const PriorityRowsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  margin-top: ${space(1)};
`;

const PriorityRowContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const PriorityLabel = styled('span')`
  min-width: 120px;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const RequiredAsterisk = styled('span')`
  color: ${p => p.theme.error};
  margin-left: ${space(0.25)};
`;
