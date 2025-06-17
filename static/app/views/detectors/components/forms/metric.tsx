import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import NumberField from 'sentry/components/forms/fields/numberField';
import SegmentedRadioField from 'sentry/components/forms/fields/segmentedRadioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  FieldKey,
  FieldKind,
  MobileVital,
  WebVital,
} from 'sentry/utils/fields';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metricFormData';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';

export function MetricDetectorForm() {
  return (
    <FormStack>
      <DetectSection />
      <PrioritizeSection />
      <ResolveSection />
      <AssignSection />
      <AutomateSection />
    </FormStack>
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
  const thresholdType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.thresholdType
  );

  return (
    <Container>
      <Section
        title={t('Resolve')}
        description={
          kind === 'dynamic'
            ? t(
                'Sentry will automatically resolve the issue when the trend goes back to baseline.'
              )
            : undefined
        }
      >
        {kind !== 'dynamic' && (
          <ThresholdField
            flexibleControlStateSize
            inline={false}
            label={
              thresholdType === AlertRuleThresholdType.BELOW
                ? t('Close an incident when the value rises above:')
                : t('Close an incident when the value dips below:')
            }
            placeholder="0"
            name={METRIC_DETECTOR_FORM_FIELDS.resolveThreshold}
            suffix="s"
          />
        )}
      </Section>
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
          Connect Automations
        </Button>
      </Section>
    </Container>
  );
}

function AssignSection() {
  return (
    <Container>
      <Section title={t('Assign')}>
        <OwnerField />
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

function DetectSection() {
  const kind = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.kind);

  const aggregateOptions: Array<[string, string]> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return [aggregate, aggregate];
    });
  }, []);

  return (
    <Container>
      <Section
        title={t('Detect')}
        description={t('Sentry will check the following query:')}
      >
        <FirstRow>
          <Flex flex={1} gap={space(1)}>
            <VisualizeField
              placeholder={t('Metric')}
              flexibleControlStateSize
              inline={false}
              label="Visualize"
              name={METRIC_DETECTOR_FORM_FIELDS.visualize}
              choices={[['transaction.duration', 'transaction.duration']]}
            />
            <AggregateField
              placeholder={t('aggregate')}
              flexibleControlStateSize
              name={METRIC_DETECTOR_FORM_FIELDS.aggregate}
              choices={aggregateOptions}
            />
          </Flex>
          <Flex flex={1} gap={space(1)}>
            <FilterField />
          </Flex>
        </FirstRow>
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

function OwnerField() {
  return (
    <StyledMemberTeamSelectorField
      placeholder={t('Select a member or team')}
      label={t('Owner')}
      help={t('Sentry will assign new issues to this owner.')}
      name="owner"
      flexibleControlStateSize
    />
  );
}

const FormStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  max-width: ${p => p.theme.breakpoints.xlarge};
`;

const FirstRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledSelectField = styled(SelectField)`
  width: 180px;
  padding: 0;
  margin: 0;

  > div {
    padding-left: 0;
  }
`;

const StyledMemberTeamSelectorField = styled(SentryMemberTeamSelectorField)`
  padding-left: 0;
`;

const VisualizeField = styled(SelectField)`
  flex: 2;
  padding-left: 0;
  padding-right: 0;
  margin-left: 0;
  border-bottom: none;
`;

const AggregateField = styled(SelectField)`
  width: 120px;
  margin-top: auto;
  padding-top: 0;
  padding-left: 0;
  padding-right: 0;
  border-bottom: none;

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

function FilterField() {
  return (
    <Flex direction="column" gap={space(0.5)} style={{paddingTop: 16, flex: 1}}>
      <span>Filter</span>
      <SearchQueryBuilder
        initialQuery=""
        filterKeySections={FILTER_KEY_SECTIONS}
        filterKeys={FILTER_KEYS}
        getTagValues={getTagValues}
        searchSource="storybook"
      />
    </Flex>
  );
}

const getTagValues = (): Promise<string[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(['foo', 'bar', 'baz']);
    }, 500);
  });
};

// TODO: replace hardcoded tags with data from API
const FILTER_KEYS: TagCollection = {
  [FieldKey.ASSIGNED]: {
    key: FieldKey.ASSIGNED,
    name: 'Assigned To',
    kind: FieldKind.FIELD,
    predefined: true,
    values: [
      {
        title: 'Suggested',
        type: 'header',
        icon: null,
        children: [{value: 'me'}, {value: 'unassigned'}],
      },
      {
        title: 'All',
        type: 'header',
        icon: null,
        children: [{value: 'person1@sentry.io'}, {value: 'person2@sentry.io'}],
      },
    ],
  },
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Internet Explorer', 'Opera 1,2'],
  },
  [FieldKey.IS]: {
    key: FieldKey.IS,
    name: 'is',
    predefined: true,
    values: ['resolved', 'unresolved', 'ignored'],
  },
  [FieldKey.LAST_SEEN]: {
    key: FieldKey.LAST_SEEN,
    name: 'lastSeen',
    kind: FieldKind.FIELD,
  },
  [FieldKey.TIMES_SEEN]: {
    key: FieldKey.TIMES_SEEN,
    name: 'timesSeen',
    kind: FieldKind.FIELD,
  },
  [WebVital.LCP]: {
    key: WebVital.LCP,
    name: 'lcp',
    kind: FieldKind.FIELD,
  },
  [MobileVital.FRAMES_SLOW_RATE]: {
    key: MobileVital.FRAMES_SLOW_RATE,
    name: 'framesSlowRate',
    kind: FieldKind.FIELD,
  },
  custom_tag_name: {
    key: 'custom_tag_name',
    name: 'Custom_Tag_Name',
  },
};

const FILTER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: 'cat_1',
    label: 'Category 1',
    children: [FieldKey.ASSIGNED, FieldKey.IS],
  },
  {
    value: 'cat_2',
    label: 'Category 2',
    children: [WebVital.LCP, MobileVital.FRAMES_SLOW_RATE],
  },
  {
    value: 'cat_3',
    label: 'Category 3',
    children: [FieldKey.TIMES_SEEN],
  },
];
