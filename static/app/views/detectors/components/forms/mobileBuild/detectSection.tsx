import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {InlineCode} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {NumberField} from 'sentry/components/forms/fields/numberField';
import {SegmentedRadioField} from 'sentry/components/forms/fields/segmentedRadioField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {useProjects} from 'sentry/utils/useProjects';
import {
  PREPROD_DETECTOR_FORM_FIELDS,
  usePreprodDetectorFormField,
} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {PriorityDot} from 'sentry/views/detectors/components/priorityDot';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
import {
  getMetricLabelForPlatform,
  guessPlatformForProject,
  isDiffThreshold,
  MEASUREMENT_OPTIONS,
  METRIC_OPTIONS,
} from 'sentry/views/settings/project/preprod/types';

function getMetricOptions(platform: Platform | undefined): Array<[string, string]> {
  return METRIC_OPTIONS.map(({value}) => [
    value,
    getMetricLabelForPlatform(value, platform),
  ]);
}

function getThresholdTypeOptions(): Array<[string, string, string]> {
  return MEASUREMENT_OPTIONS.map(({value, label, description}) => [
    value,
    label,
    description,
  ]);
}

export function MobileBuildDetectSection() {
  const thresholdType =
    usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.thresholdType) ?? 'absolute';
  const projectId = usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.projectId);
  const {projects} = useProjects();

  const project = projects.find(p => p.id === projectId);
  const maybePlatform = project ? guessPlatformForProject(project) : undefined;

  const metricOptions = useMemo(() => getMetricOptions(maybePlatform), [maybePlatform]);
  const thresholdTypeOptions = useMemo(getThresholdTypeOptions, []);

  return (
    <Fragment>
      <Container>
        <Stack gap="md">
          <Heading as="h3">{t('Choose Your Measurement')}</Heading>
          <MetricField
            name={PREPROD_DETECTOR_FORM_FIELDS.measurement}
            choices={metricOptions}
            inline={false}
            flexibleControlStateSize
            preserveOnUnmount
          />
        </Stack>
      </Container>

      <Container>
        <Stack gap="lg">
          <section>
            <Heading as="h3">{t('Issue Detection')}</Heading>
            <MeasurementField
              name={PREPROD_DETECTOR_FORM_FIELDS.thresholdType}
              choices={thresholdTypeOptions}
              inline={false}
              flexibleControlStateSize
              preserveOnUnmount
            />
            {isDiffThreshold(thresholdType) && (
              <Flex align="center" gap="sm">
                <IconInfo size="xs" />
                <Text variant="muted" size="sm">
                  {tct(
                    "Compares against the previous build matching this monitor's filters, [platform], [packageName], and [buildConfiguration].",
                    {
                      platform: <InlineCode>platform</InlineCode>,
                      packageName: <InlineCode>package_name</InlineCode>,
                      buildConfiguration: <InlineCode>build_configuration</InlineCode>,
                    }
                  )}
                </Text>
              </Flex>
            )}
          </section>

          <ThresholdSection thresholdType={thresholdType} />
        </Stack>
      </Container>
    </Fragment>
  );
}

function ThresholdSection({
  thresholdType,
}: {
  thresholdType: 'absolute' | 'absolute_diff' | 'relative_diff';
}) {
  const isPercentage = thresholdType === 'relative_diff';

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

type SupportedPriorityLevel = Extract<
  DetectorPriorityLevel,
  DetectorPriorityLevel.HIGH | DetectorPriorityLevel.LOW
>;

function validateAtLeastOneThreshold({
  id,
  form,
}: {
  form: Record<string, any>;
  id: string;
}): Array<[string, string]> {
  const high = form[PREPROD_DETECTOR_FORM_FIELDS.highThreshold];
  const low = form[PREPROD_DETECTOR_FORM_FIELDS.lowThreshold];

  if (!high && !low) {
    return [[id, t('At least one threshold is required')]];
  }
  return [];
}

function PriorityRow({
  priority,
  isPercentage,
}: {
  isPercentage: boolean;
  priority: SupportedPriorityLevel;
}) {
  let priorityLabel: string;
  let thresholdFieldName: string;
  switch (priority) {
    case DetectorPriorityLevel.HIGH:
      priorityLabel = t('High priority');
      thresholdFieldName = PREPROD_DETECTOR_FORM_FIELDS.highThreshold;
      break;
    case DetectorPriorityLevel.LOW:
      priorityLabel = t('Low priority');
      thresholdFieldName = PREPROD_DETECTOR_FORM_FIELDS.lowThreshold;
      break;
    default:
      return null;
  }

  return (
    <Flex align="center" gap="md">
      <PriorityDot priority={DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[priority]} />
      <PriorityLabel>{priorityLabel}</PriorityLabel>
      <Flex align="center" gap="md">
        <ThresholdField
          name={thresholdFieldName}
          placeholder="-"
          hideLabel
          inline
          required={false}
          validate={
            priority === DetectorPriorityLevel.HIGH
              ? validateAtLeastOneThreshold
              : undefined
          }
          preserveOnUnmount
        />
        <ThresholdSuffix>{isPercentage ? '%' : 'MB'}</ThresholdSuffix>
      </Flex>
    </Flex>
  );
}

const MetricField = styled(SegmentedRadioField)`
  padding-left: 0;
  padding-block: ${p => p.theme.space.md};
  border-bottom: none;
  max-width: 420px;

  > div {
    padding: 0;
  }
`;

const MeasurementField = styled(SegmentedRadioField)`
  padding-left: 0;
  padding-block: ${p => p.theme.space.md};
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
  font-weight: ${p => p.theme.font.weight.sans.regular};
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
  font-size: ${p => p.theme.font.size.md};
`;
