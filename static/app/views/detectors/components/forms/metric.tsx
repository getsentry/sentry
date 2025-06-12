import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import NumberField from 'sentry/components/forms/fields/numberField';
import SegmentedRadioField from 'sentry/components/forms/fields/segmentedRadioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import Form from 'sentry/components/forms/form';
import FormContext from 'sentry/components/forms/formContext';
import type FormModel from 'sentry/components/forms/model';
import Spinner from 'sentry/components/forms/spinner';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
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

type MetricDetectorKind = 'threshold' | 'change' | 'dynamic';

export function MetricDetectorForm({model}: {model: FormModel}) {
  return (
    <Form hideFooter model={model}>
      <ChartContainer>
        <Spinner />
      </ChartContainer>
      <FormStack>
        <DetectSection />
        <PrioritizeSection />
        <ResolveSection />
        <AssignSection />
        <AutomateSection />
      </FormStack>
    </Form>
  );
}

function MonitorKind() {
  const formContext = useContext(FormContext);

  /**
   * Reset other fields when kind changes
   */
  function handleChangeKind(kind: MetricDetectorKind) {
    if (kind === 'threshold') {
      formContext.form?.setValue('conditionGroup.conditions.0.type', 'above');
    } else if (kind === 'change') {
      formContext.form?.setValue('conditionGroup.conditions.0.type', 'higher');
    } else if (kind === 'dynamic') {
      formContext.form?.setValue('conditionGroup.conditions.0.type', 'above');
    }
  }

  return (
    <MonitorKindField
      label={t('...and monitor for changes in the following way:')}
      flexibleControlStateSize
      inline={false}
      name="kind"
      defaultValue="threshold"
      onChange={handleChangeKind}
      choices={[
        [
          'threshold',
          t('Threshold'),
          t('Absolute-valued thresholds, for non-seasonal data.'),
        ],
        ['change', t('Change'), t('Percentage changes over defined time windows.')],
        [
          'dynamic',
          t('Dynamic'),
          t('Auto-detect anomalies and mean deviation, for seasonal/noisy data.'),
        ],
      ]}
    />
  );
}

function ResolveSection() {
  const kind = useFormField<MetricDetectorKind>('kind')!;

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
            label={t('Close an incident when the value dips below:')}
            placeholder="0"
            name="resolve_threshold"
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
  const kind = useFormField<MetricDetectorKind>('kind')!;
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
        {kind !== 'dynamic' && <PriorityControl />}
      </Section>
    </Container>
  );
}

function DetectSection() {
  const kind = useFormField<MetricDetectorKind>('kind')!;
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
          <DetectColumn>
            <VisualizeField
              placeholder={t('Metric')}
              flexibleControlStateSize
              inline={false}
              label="Visualize"
              name="visualize"
              choices={[['span.duration', 'span.duration']]}
              defaultValue="span.duration"
            />
            <AggregateField
              placeholder={t('aggregate')}
              flexibleControlStateSize
              defaultValue={'p75'}
              name="aggregate"
              choices={aggregateOptions}
            />
          </DetectColumn>
          <DetectColumn>
            <FilterField />
          </DetectColumn>
        </FirstRow>
        <MonitorKind />
        <Flex column>
          {(!kind || kind === 'threshold') && (
            <Flex column>
              <MutedText>{t('An issue will be created when query value is:')}</MutedText>
              <Flex align="center" gap={space(1)}>
                <DirectionField
                  name="conditionGroup.conditions.0.type"
                  hideLabel
                  inline
                  defaultValue="above"
                  flexibleControlStateSize
                  choices={[
                    ['above', t('Above')],
                    ['below', t('Below')],
                  ]}
                />
                <ThresholdField
                  flexibleControlStateSize
                  inline={false}
                  hideLabel
                  placeholder="0"
                  name="conditionGroup.conditions.0.comparison"
                  suffix="s"
                />
              </Flex>
            </Flex>
          )}
          {kind === 'change' && (
            <Flex column>
              <MutedText>{t('An issue will be created when query value is:')}</MutedText>
              <Flex align="center" gap={space(1)}>
                <ChangePercentField
                  name="conditionGroup.conditions.0.comparison"
                  placeholder="0"
                  hideLabel
                  inline
                />
                <span>{t('percent')}</span>
                <DirectionField
                  name="conditionGroup.conditions.0.type"
                  hideLabel
                  inline
                  defaultValue="higher"
                  flexibleControlStateSize
                  choices={[
                    ['higher', t('higher')],
                    ['lower', t('lower')],
                  ]}
                />
                <span>{t('than the previous')}</span>
                <StyledSelectField
                  name="config.low_threshold.unit"
                  hideLabel
                  inline
                  defaultValue="1 hour"
                  flexibleControlStateSize
                  choices={[
                    ['5 minutes', '5 minutes'],
                    ['15 minutes', '15 minutes'],
                    ['1 hour', '1 hour'],
                    ['1 day', '1 day'],
                    ['1 week', '1 week'],
                    ['1 month', '1 month'],
                  ]}
                />
              </Flex>
            </Flex>
          )}
          {kind === 'dynamic' && (
            <Flex column>
              <SelectField
                required
                name="config.sensitivity"
                label={t('Level of responsiveness')}
                help={t(
                  'Choose your level of anomaly responsiveness. Higher thresholds means alerts for most anomalies. Lower thresholds means alerts only for larger ones.'
                )}
                defaultValue={AlertRuleSensitivity.MEDIUM}
                choices={[
                  [AlertRuleSensitivity.HIGH, t('High')],
                  [AlertRuleSensitivity.MEDIUM, t('Medium')],
                  [AlertRuleSensitivity.LOW, t('Low')],
                ]}
              />
              <SelectField
                required
                name="config.thresholdType"
                label={t('Direction of anomaly movement')}
                help={t(
                  'Decide if you want to be alerted to anomalies that are moving above, below, or in both directions in relation to your threshold.'
                )}
                defaultValue={AlertRuleThresholdType.ABOVE_AND_BELOW}
                choices={[
                  [AlertRuleThresholdType.ABOVE, t('Above')],
                  [AlertRuleThresholdType.ABOVE_AND_BELOW, t('Above and Below')],
                  [AlertRuleThresholdType.BELOW, t('Below')],
                ]}
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

const FormStack = styled(Flex)`
  max-width: ${p => p.theme.breakpoints.xlarge};
  flex-direction: column;
  gap: ${space(4)};
  padding: ${space(4)};
`;

const FirstRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

function DetectColumn(props: React.ComponentProps<typeof Flex>) {
  return <Flex flex={1} gap={space(1)} {...props} />;
}

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

const ChartContainer = styled('div')`
  background: ${p => p.theme.background};
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: 24px 32px 16px 32px;
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
    <Flex column gap={space(0.5)} style={{paddingTop: 16, flex: 1}}>
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
