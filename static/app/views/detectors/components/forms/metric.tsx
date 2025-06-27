import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import Duration from 'sentry/components/duration';
import NumberField from 'sentry/components/forms/fields/numberField';
import SegmentedRadioField from 'sentry/components/forms/fields/segmentedRadioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import FormContext from 'sentry/components/forms/formContext';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
import {AssigneeField} from 'sentry/views/detectors/components/forms/assigneeField';
import {getDatasetConfig} from 'sentry/views/detectors/components/forms/getDatasetConfig';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metricFormData';
import {
  DetectorDataset,
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {useDetectorThresholdSuffix} from 'sentry/views/detectors/components/forms/useDetectorThresholdSuffix';
import {Visualize} from 'sentry/views/detectors/components/forms/visualize';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

function MetricDetectorFormContext({children}: {children: React.ReactNode}) {
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const {projects} = useProjects();

  const traceItemProjects = useMemo(() => {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      return undefined;
    }
    return [project];
  }, [projectId, projects]);

  return (
    <TraceItemAttributeProvider
      traceItemType={TraceItemDataset.SPANS}
      projects={traceItemProjects}
      enabled
    >
      {children}
    </TraceItemAttributeProvider>
  );
}

export function MetricDetectorForm() {
  return (
    <MetricDetectorFormContext>
      <FormStack>
        <DetectSection />
        <PrioritizeSection />
        <ResolveSection />
        <AssignSection />
        <AutomateSection />
      </FormStack>
    </MetricDetectorFormContext>
  );
}

function MonitorKind() {
  const options: Array<[MetricDetectorFormData['kind'], string, string]> = [
    ['static', t('Threshold'), t('Absolute-valued thresholds, for non-seasonal data.')],
    ['percent', t('Change'), t('Percentage changes over defined time windows.')],
    [
      'dynamic',
      t('Dynamic'),
      t('Auto-detect anomalies and mean deviation, for seasonal/noisy data.'),
    ],
  ];

  return (
    <MonitorKindField
      label={t('\u2026and monitor for changes in the following way:')}
      flexibleControlStateSize
      inline={false}
      name={METRIC_DETECTOR_FORM_FIELDS.kind}
      defaultValue="threshold"
      choices={options}
    />
  );
}

function ResolveSection() {
  const kind = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.kind);
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionComparisonAgo = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionComparisonAgo
  );
  const thresholdSuffix = useDetectorThresholdSuffix();

  let description: string | undefined;
  if (kind === 'dynamic') {
    description = t(
      'Sentry will automatically resolve the issue when the trend goes back to baseline.'
    );
  } else if (kind === 'static') {
    if (conditionType === DataConditionType.GREATER) {
      description = t(
        'Issue will be resolved when the query value is less than %s%s.',
        conditionValue || '0',
        thresholdSuffix
      );
    } else {
      description = t(
        'Issue will be resolved when the query value is more than %s%s.',
        conditionValue || '0',
        thresholdSuffix
      );
    }
  } else if (kind === 'percent') {
    if (conditionType === DataConditionType.GREATER) {
      description = t(
        'Issue will be resolved when the query value is less than %s%% higher than the previous %s.',
        conditionValue || '0',
        conditionComparisonAgo ? <Duration seconds={conditionComparisonAgo} /> : ''
      );
    } else {
      description = t(
        'Issue will be resolved when the query value is less than %s%% lower than the previous %s.',
        conditionValue || '0',
        conditionComparisonAgo ? <Duration seconds={conditionComparisonAgo} /> : ''
      );
    }
  }

  return (
    <Container>
      <Section title={t('Resolve')} description={description} />
    </Container>
  );
}

function AutomateSection() {
  return (
    <Container>
      <Section title={t('Automate')} description={t('Set up alerts or notifications.')}>
        <Button
          size="md"
          style={{width: 'min-content'}}
          priority="primary"
          icon={<IconAdd />}
        >
          {t('Connect Automations')}
        </Button>
      </Section>
    </Container>
  );
}

function AssignSection() {
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);

  return (
    <Container>
      <Section title={t('Assign')}>
        <AssigneeField projectId={projectId} />
      </Section>
    </Container>
  );
}

function PrioritizeSection() {
  const kind = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.kind);
  return (
    <Container>
      <Section
        title={t('Prioritize')}
        description={
          kind === 'dynamic'
            ? t('Sentry will automatically update priority.')
            : t('Update issue priority when the following thresholds are met:')
        }
      >
        {kind !== 'dynamic' && (
          <PriorityControl minimumPriority={DetectorPriorityLevel.MEDIUM} />
        )}
      </Section>
    </Container>
  );
}

function useDatasetChoices() {
  const organization = useOrganization();

  return useMemo(() => {
    const datasetChoices: Array<[DetectorDataset, string]> = [
      [DetectorDataset.ERRORS, t('Errors')],
      [DetectorDataset.TRANSACTIONS, t('Transactions')],
      ...(organization.features.includes('visibility-explore-view')
        ? ([[DetectorDataset.SPANS, t('Spans')]] as Array<[DetectorDataset, string]>)
        : []),
      [DetectorDataset.RELEASES, t('Releases')],
    ];

    return datasetChoices;
  }, [organization]);
}

function DetectSection() {
  const kind = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.kind);
  const datasetChoices = useDatasetChoices();
  const formContext = useContext(FormContext);

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
            choices={datasetChoices}
            onChange={newDataset => {
              // Reset aggregate function to dataset default when dataset changes
              const datasetConfig = getDatasetConfig(newDataset);
              const defaultAggregate = generateFieldAsString(datasetConfig.defaultField);
              formContext.form?.setValue(
                METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
                defaultAggregate
              );
            }}
          />
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
            choices={[
              // TODO: We will probably need to change these options based on dataset
              // Similar to metric alerts see static/app/views/alerts/rules/metric/constants.tsx
              [60, t('1 minute')],
              [5 * 60, t('5 minutes')],
              [15 * 60, t('15 minutes')],
              [30 * 60, t('30 minutes')],
              [60 * 60, t('1 hour')],
              [4 * 60 * 60, t('4 hours')],
              [24 * 60 * 60, t('1 day')],
            ]}
          />
        </DatasetRow>
        <Visualize />
        <MonitorKind />
        <Flex direction="column">
          {(!kind || kind === 'static') && (
            <Flex direction="column">
              <MutedText>{t('An issue will be created when query value is:')}</MutedText>
              <Flex align="center" gap={space(1)}>
                <DirectionField
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
                  flexibleControlStateSize
                  inline={false}
                  hideLabel
                  placeholder="0"
                  name={METRIC_DETECTOR_FORM_FIELDS.conditionValue}
                  suffix="s"
                  required
                  preserveOnUnmount
                />
              </Flex>
            </Flex>
          )}
          {kind === 'percent' && (
            <Flex direction="column">
              <MutedText>{t('An issue will be created when query value is:')}</MutedText>
              <Flex align="center" gap={space(1)}>
                <ChangePercentField
                  name={METRIC_DETECTOR_FORM_FIELDS.conditionValue}
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
          {kind === 'dynamic' && (
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

const MonitorKindField = styled(SegmentedRadioField)`
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
    width: 10ch;
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
