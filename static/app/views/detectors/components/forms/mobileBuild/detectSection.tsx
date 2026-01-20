import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import NumberField from 'sentry/components/forms/fields/numberField';
import SegmentedRadioField from 'sentry/components/forms/fields/segmentedRadioField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {MobileBuildFilterBuilder} from 'sentry/views/detectors/components/forms/mobileBuild/filterBuilder';
import {
  PREPROD_DETECTOR_FORM_FIELDS,
  usePreprodDetectorFormField,
} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {PriorityDot} from 'sentry/views/detectors/components/priorityDot';
import {
  MEASUREMENT_OPTIONS,
  METRIC_OPTIONS,
} from 'sentry/views/settings/project/preprod/types';

function getMetricOptions(): Array<[string, string]> {
  return METRIC_OPTIONS.map(({value, label}) => [value, label]);
}

function getMeasurementOptions(): Array<[string, string, string]> {
  return MEASUREMENT_OPTIONS.map(({value, label, description}) => [
    value,
    label,
    description,
  ]);
}

export function MobileBuildDetectSection() {
  const measurement = usePreprodDetectorFormField(
    PREPROD_DETECTOR_FORM_FIELDS.measurement
  );

  const metricOptions = useMemo(getMetricOptions, []);
  const measurementOptions = useMemo(getMeasurementOptions, []);

  return (
    <Fragment>
      <Container>
        <Stack gap="md">
          <Heading as="h3">{t('Choose Your Measurement')}</Heading>
          <MetricField
            name={PREPROD_DETECTOR_FORM_FIELDS.metric}
            choices={metricOptions}
            inline={false}
            flexibleControlStateSize
            preserveOnUnmount
          />
        </Stack>
      </Container>

      <Container>
        <Stack gap="md">
          <Heading as="h3">{t('Filter (optional)')}</Heading>
          <MobileBuildFilterBuilder />
        </Stack>
      </Container>

      <Container>
        <Stack gap="lg">
          <section>
            <Heading as="h3">{t('Issue Detection')}</Heading>
            <MeasurementField
              name={PREPROD_DETECTOR_FORM_FIELDS.measurement}
              choices={measurementOptions}
              inline={false}
              flexibleControlStateSize
              preserveOnUnmount
            />
          </section>

          <ThresholdSection measurement={measurement} />
        </Stack>
      </Container>
    </Fragment>
  );
}

function ThresholdSection({
  measurement,
}: {
  measurement: 'absolute' | 'absolute_diff' | 'relative_diff';
}) {
  const isPercentage = measurement === 'relative_diff';

  // Omit medium on purpose even though we support that in general.

  return (
    <section>
      <DefineThresholdParagraph>
        <Text bold>{t('Define threshold & set priority')}</Text>
        <Text variant="muted">
          {t('Issues will be created when the query value passes the set threshold.')}
        </Text>
      </DefineThresholdParagraph>
      <Stack marginTop="md" gap="xl">
        <PriorityRow priority={DetectorPriorityLevel.HIGH} isPercentage={isPercentage} />
        <PriorityRow priority={DetectorPriorityLevel.LOW} isPercentage={isPercentage} />
      </Stack>
    </section>
  );
}

type NonOkPriorityLevel = Exclude<DetectorPriorityLevel, DetectorPriorityLevel.OK>;

function PriorityRow({
  priority,
  isPercentage,
}: {
  isPercentage: boolean;
  priority: NonOkPriorityLevel;
}) {
  let required: boolean;
  let priorityLabel: string;
  let thresholdFieldName: string;
  switch (priority) {
    case DetectorPriorityLevel.HIGH:
      priorityLabel = t('High priority');
      thresholdFieldName = PREPROD_DETECTOR_FORM_FIELDS.highThreshold;
      required = true;
      break;
    case DetectorPriorityLevel.MEDIUM:
      priorityLabel = t('Medium priority');
      thresholdFieldName = PREPROD_DETECTOR_FORM_FIELDS.mediumThreshold;
      required = false;
      break;
    case DetectorPriorityLevel.LOW:
      priorityLabel = t('Low priority');
      thresholdFieldName = PREPROD_DETECTOR_FORM_FIELDS.lowThreshold;
      required = false;
      break;
  }

  return (
    <Flex align="center" gap="md">
      <PriorityDot priority={DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[priority]} />
      <PriorityLabel>
        {priorityLabel}
        {required && <RequiredAsterisk>*</RequiredAsterisk>}
      </PriorityLabel>
      <Flex align="center" gap="md">
        <ThresholdField
          name={thresholdFieldName}
          placeholder="-"
          hideLabel
          inline
          required={required}
          preserveOnUnmount
        />
        <ThresholdSuffix>{isPercentage ? '%' : 'MB'}</ThresholdSuffix>
      </Flex>
    </Flex>
  );
}

const MetricField = styled(SegmentedRadioField)`
  padding-left: 0;
  padding-block: ${space(1)};
  border-bottom: none;
  max-width: 420px;

  > div {
    padding: 0;
  }
`;

const MeasurementField = styled(SegmentedRadioField)`
  padding-left: 0;
  padding-block: ${space(1)};
  border-bottom: none;
  max-width: 840px;

  > div {
    padding: 0;
  }
`;

const DefineThresholdParagraph = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  flex-direction: column;
  margin-bottom: ${p => p.theme.space.sm};
  padding-top: ${p => p.theme.space.lg};
  margin-top: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const PriorityLabel = styled('span')`
  min-width: 120px;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const RequiredAsterisk = styled('span')`
  color: ${p => p.theme.tokens.content.danger};
  margin-left: ${space(0.25)};
`;

const ThresholdField = styled(NumberField)`
  padding: 0;
  margin: 0;
  border: none;

  > div {
    padding: 0;
    width: 10ch;
  }
`;

const ThresholdSuffix = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.md};
`;
