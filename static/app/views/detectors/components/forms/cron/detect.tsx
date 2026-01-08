import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section, {SectionSubHeading} from 'sentry/components/workflowEngine/ui/section';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {
  CRON_DEFAULT_CHECKIN_MARGIN,
  CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD,
  CRON_DEFAULT_MAX_RUNTIME,
  CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT,
  CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
  CRON_DEFAULT_SCHEDULE_TYPE,
  DEFAULT_CRONTAB,
  useCronDetectorFormField,
} from 'sentry/views/detectors/components/forms/cron/fields';
import {ScheduleType} from 'sentry/views/insights/crons/types';
import {getScheduleIntervals} from 'sentry/views/insights/crons/utils';
import {crontabAsText} from 'sentry/views/insights/crons/utils/crontabAsText';

const SCHEDULE_OPTIONS: Array<SelectValue<string>> = [
  {value: ScheduleType.CRONTAB, label: t('Crontab')},
  {value: ScheduleType.INTERVAL, label: t('Interval')},
];

const CHECKIN_MARGIN_MINIMUM = 1;
const TIMEOUT_MINIMUM = 1;

function ScheduleTypeField() {
  return (
    <SelectField
      name="scheduleType"
      label={t('Schedule Type')}
      hideLabel
      options={SCHEDULE_OPTIONS}
      defaultValue={CRON_DEFAULT_SCHEDULE_TYPE}
      orientInline
      required
      stacked
      inline={false}
      preserveOnUnmount
    />
  );
}

function Schedule() {
  const theme = useTheme();
  const scheduleCrontab = useCronDetectorFormField('scheduleCrontab');
  const scheduleIntervalValue = useCronDetectorFormField('scheduleIntervalValue');
  const scheduleType = useCronDetectorFormField('scheduleType');

  const parsedSchedule =
    scheduleType === 'crontab' ? crontabAsText(scheduleCrontab) : null;

  if (scheduleType === 'crontab') {
    return (
      <InputGroup removeFieldPadding>
        <ScheduleTypeField />
        <MultiColumnInput columns="1fr 2fr">
          <TextField
            name="scheduleCrontab"
            label={t('Crontab Schedule')}
            hideLabel
            placeholder="* * * * *"
            defaultValue={DEFAULT_CRONTAB}
            css={css`
              input {
                font-family: ${theme.text.familyMono};
              }
            `}
            required
            stacked
            inline={false}
            preserveOnUnmount
          />
          <SelectField
            name="timezone"
            label={t('Timezone')}
            hideLabel
            defaultValue="UTC"
            options={timezoneOptions}
            required
            stacked
            inline={false}
            preserveOnUnmount
          />
          {parsedSchedule && <CronstrueText>"{parsedSchedule}"</CronstrueText>}
        </MultiColumnInput>
      </InputGroup>
    );
  }

  if (scheduleType === 'interval') {
    return (
      <InputGroup removeFieldPadding>
        <ScheduleTypeField />
        <MultiColumnInput columns="auto 1fr 2fr">
          <LabelText>{t('Every')}</LabelText>
          <NumberField
            name="scheduleIntervalValue"
            label={t('Interval Frequency')}
            hideLabel
            placeholder="e.g. 1"
            defaultValue={CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE}
            min={1}
            required
            stacked
            inline={false}
            preserveOnUnmount
          />
          <SelectField
            name="scheduleIntervalUnit"
            label={t('Interval Type')}
            hideLabel
            options={getScheduleIntervals(scheduleIntervalValue)}
            defaultValue={CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT}
            required
            stacked
            inline={false}
            preserveOnUnmount
          />
        </MultiColumnInput>
      </InputGroup>
    );
  }

  return null;
}

function Margins() {
  return (
    <Fragment>
      <SubSectionSeparator aria-hidden="true" />
      <SectionSubHeading>{t('Set margins')}</SectionSubHeading>
      <InputGroup>
        <NumberField
          name="checkinMargin"
          min={CHECKIN_MARGIN_MINIMUM}
          placeholder={tn(
            'Defaults to %s minute',
            'Defaults to %s minutes',
            CRON_DEFAULT_CHECKIN_MARGIN
          )}
          help={t('Number of minutes before a check-in is considered missed.')}
          label={t('Grace Period')}
          defaultValue={CRON_DEFAULT_CHECKIN_MARGIN}
        />
        <NumberField
          name="maxRuntime"
          min={TIMEOUT_MINIMUM}
          placeholder={tn(
            'Defaults to %s minute',
            'Defaults to %s minutes',
            CRON_DEFAULT_MAX_RUNTIME
          )}
          help={t(
            'Number of minutes before an in-progress check-in is marked timed out.'
          )}
          label={t('Max Runtime')}
          defaultValue={CRON_DEFAULT_MAX_RUNTIME}
        />
      </InputGroup>
    </Fragment>
  );
}

function Thresholds() {
  return (
    <Fragment>
      <SubSectionSeparator aria-hidden="true" />
      <SectionSubHeading>{t('Set thresholds')}</SectionSubHeading>
      <InputGroup>
        <NumberField
          name="failureIssueThreshold"
          min={1}
          placeholder="1"
          defaultValue={CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD}
          help={t(
            'Create a new issue when this many consecutive missed or error check-ins are processed.'
          )}
          label={t('Failure Tolerance')}
        />
      </InputGroup>
    </Fragment>
  );
}

export function CronDetectorFormDetectSection() {
  return (
    <Container>
      <Section title={t('Detect')}>
        <DetectFieldsContainer>
          <div>
            <SectionSubHeading>{t('Set your schedule')}</SectionSubHeading>
            <Text variant="muted">
              {tct('You can use [link:the crontab syntax] or our interval schedule.', {
                link: <ExternalLink href="https://en.wikipedia.org/wiki/Cron" />,
              })}
            </Text>
            <Schedule />
            <Margins />
            <Thresholds />
          </div>
        </DetectFieldsContainer>
      </Section>
    </Container>
  );
}

const DetectFieldsContainer = styled('div')`
  ${FieldWrapper} {
    padding-left: 0;
  }
`;

const SubSectionSeparator = styled('hr')`
  height: 1px;
  border: none;
  margin: 0;
  margin-bottom: ${p => p.theme.space.lg};
  background-color: ${p => p.theme.tokens.border.primary};
`;

const InputGroup = styled('div')<{removeFieldPadding?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  ${p =>
    p.removeFieldPadding &&
    css`
      padding: ${p.theme.space.xl};
      padding-left: 0;
    `};

  ${FieldWrapper} {
    ${p =>
      p.removeFieldPadding &&
      css`
        padding: 0;
      `};
  }
`;

const LabelText = styled(Text)`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
`;

const MultiColumnInput = styled('div')<{columns?: string}>`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-template-columns: ${p => p.columns};

  ${FieldWrapper} {
    padding-bottom: 0;
  }
`;

const CronstrueText = styled(LabelText)`
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xs};
  font-family: ${p => p.theme.text.familyMono};
  grid-column: auto / span 2;
`;
