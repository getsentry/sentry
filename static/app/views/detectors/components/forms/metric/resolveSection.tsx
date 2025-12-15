import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text/text';
import type {RadioOption} from 'sentry/components/forms/controls/radioGroup';
import NumberField from 'sentry/components/forms/fields/numberField';
import RadioField from 'sentry/components/forms/fields/radioField';
import {t} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {getResolutionDescription} from 'sentry/views/detectors/utils/getDetectorResolutionDescription';
import {getStaticDetectorThresholdSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

import type {MetricDetectorFormData} from './metricFormData';
import {METRIC_DETECTOR_FORM_FIELDS, useMetricDetectorFormField} from './metricFormData';

function validateThresholdOrder(
  value: number,
  reference: number,
  conditionType: DataConditionType,
  isGreaterExpected: boolean
): boolean {
  if (conditionType === DataConditionType.GREATER) {
    return isGreaterExpected ? value > reference : value < reference;
  }
  // For LESS condition type, logic is inverted
  return isGreaterExpected ? value < reference : value > reference;
}

function validateResolutionThreshold({
  form,
}: {
  form: MetricDetectorFormData;
  id: string;
}): Array<[string, string]> {
  const {
    conditionType,
    highThreshold,
    mediumThreshold,
    detectionType,
    resolutionStrategy,
  } = form;
  if (
    !conditionType ||
    (detectionType !== 'static' && detectionType !== 'percent') ||
    resolutionStrategy !== 'custom'
  ) {
    return [];
  }

  const resolutionNum = Number(form.resolutionValue);
  const conditionNum = Number(mediumThreshold || highThreshold);

  if (
    Number.isFinite(resolutionNum) &&
    Number.isFinite(conditionNum) &&
    !validateThresholdOrder(resolutionNum, conditionNum, conditionType, false)
  ) {
    const message = t(
      'Resolution threshold must be %s than alert threshold (%s)',
      conditionType === DataConditionType.GREATER ? t('lower') : t('higher'),
      String(conditionNum)
    );
    return [[METRIC_DETECTOR_FORM_FIELDS.resolutionValue, message]];
  }

  return [];
}

export function ResolveSection() {
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const highThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.highThreshold
  );
  const mediumThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.mediumThreshold
  );
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionComparisonAgo = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionComparisonAgo
  );
  const resolutionStrategy = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.resolutionStrategy
  );
  const aggregate = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );

  if (detectionType === 'dynamic') {
    return null;
  }

  const thresholdSuffix = getStaticDetectorThresholdSuffix(aggregate);

  // Compute the automatic resolution threshold: medium if present, otherwise high
  const resolutionThreshold =
    mediumThreshold && mediumThreshold !== '' ? mediumThreshold : highThreshold || 0;

  const descriptionContent = getResolutionDescription(
    detectionType === 'percent'
      ? {
          detectionType: 'percent',
          conditionType,
          highThreshold: highThreshold || 0,
          resolutionThreshold,
          comparisonDelta: conditionComparisonAgo ?? 3600, // Default to 1 hour if not set
          thresholdSuffix,
        }
      : detectionType === 'static'
        ? {
            detectionType: 'static',
            conditionType,
            highThreshold: highThreshold || 0,
            resolutionThreshold,
            thresholdSuffix,
          }
        : {
            detectionType: 'dynamic',
            thresholdSuffix,
          }
  );

  const resolutionStrategyChoices: RadioOption[] = [
    [
      'default' satisfies MetricDetectorFormData['resolutionStrategy'],
      t('Default'),
      <div key="automatic">
        <Text size="sm" variant="muted" style={{marginTop: '4px'}}>
          {descriptionContent}
        </Text>
      </div>,
    ],
    [
      'custom' satisfies MetricDetectorFormData['resolutionStrategy'],
      t('Custom'),
      <div key="manual">
        <Text size="sm" variant="muted" style={{marginTop: '4px'}}>
          {t('Issue will be resolved when the query result is\u2026')}
        </Text>
      </div>,
    ],
  ];

  return (
    <div>
      <FormRow>
        <StyledRadioField
          name={METRIC_DETECTOR_FORM_FIELDS.resolutionStrategy}
          aria-label={t('Resolution method')}
          choices={resolutionStrategyChoices}
          defaultValue="automatic"
          preserveOnUnmount
        />
      </FormRow>
      {resolutionStrategy === 'custom' && (
        <DescriptionContainer onClick={e => e.preventDefault()}>
          <Text>
            {conditionType === DataConditionType.GREATER
              ? t('Less than')
              : t('More than')}
          </Text>
          <ThresholdField
            hideLabel
            aria-label={t('Resolution threshold')}
            name={METRIC_DETECTOR_FORM_FIELDS.resolutionValue}
            inline={false}
            flexibleControlStateSize
            placeholder="0"
            suffix={detectionType === 'percent' ? '%' : thresholdSuffix}
            validate={validateResolutionThreshold}
            required
            preserveOnUnmount
            size="xs"
          />
        </DescriptionContainer>
      )}
    </div>
  );
}

const FormRow = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledRadioField = styled(RadioField)`
  flex: 1;
  padding: 0;

  & > label {
    height: 33px;
  }

  & > div {
    padding: 0;
  }
`;

const DescriptionContainer = styled('div')`
  display: flex;
  align-items: center;
  min-height: 36px;
  gap: ${p => p.theme.space.sm};
  margin-left: 30px;
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
