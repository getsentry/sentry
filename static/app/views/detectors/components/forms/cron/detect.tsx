import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container as LayoutContainer, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import type {SelectValue} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import {NumberField} from 'sentry/components/forms/fields/numberField';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {
  FormSection,
  FormSectionSubHeading,
} from 'sentry/components/workflowEngine/ui/formSection';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct, tn} from 'sentry/locale';
import {
  DEFAULT_CHECKIN_MARGIN,
  DEFAULT_MAX_RUNTIME,
  MAX_RUNTIME_LIMIT,
} from 'sentry/utils/monitor/cron';
import {
  CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD,
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
      flexibleControlStateSize
      options={SCHEDULE_OPTIONS}
      defaultValue={CRON_DEFAULT_SCHEDULE_TYPE}
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
        <LayoutContainer containerType="inline-size">
          <Grid
            columns={{
              zero: 'minmax(0, 1fr)',
              '3xs': '120px minmax(0, 1fr)',
              sm: '120px minmax(0, 1fr) 200px',
            }}
            gap="md"
          >
            <ScheduleTypeField />
            <TextField
              name="scheduleCrontab"
              flexibleControlStateSize
              label={t('Crontab Schedule')}
              hideLabel
              placeholder="* * * * *"
              defaultValue={DEFAULT_CRONTAB}
              css={css`
                input {
                  font-family: ${theme.font.family.mono};
                }
              `}
              required
              stacked
              inline={false}
              preserveOnUnmount
            />
            <LayoutContainer column={{zero: '1 / -1', sm: 'auto'}}>
              <SelectField
                name="timezone"
                flexibleControlStateSize
                label={t('Timezone')}
                hideLabel
                defaultValue="UTC"
                options={timezoneOptions}
                required
                stacked
                inline={false}
                preserveOnUnmount
              />
            </LayoutContainer>
          </Grid>
        </LayoutContainer>
        {parsedSchedule && <CronstrueText>"{parsedSchedule}"</CronstrueText>}
      </InputGroup>
    );
  }

  if (scheduleType === 'interval') {
    return (
      <InputGroup removeFieldPadding>
        <LayoutContainer containerType="inline-size">
          <Grid
            columns={{
              zero: 'minmax(0, 1fr)',
              '3xs': '120px max-content 80px',
              '2xs': '120px max-content 120px',
            }}
            align="center"
            justify="start"
            gap={{zero: 'md', '3xs': 'sm', '2xs': 'md'}}
          >
            <ScheduleTypeField />
            <Grid
              columns={{
                zero: 'max-content minmax(0, 1fr)',
                '3xs': 'max-content 60px',
                '2xs': 'max-content 80px',
              }}
              align="center"
              gap={{zero: 'md', '3xs': 'sm', '2xs': 'md'}}
            >
              <LabelText>{t('Every')}</LabelText>
              <NumberField
                name="scheduleIntervalValue"
                flexibleControlStateSize
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
            </Grid>
            <SelectField
              name="scheduleIntervalUnit"
              flexibleControlStateSize
              label={t('Interval Type')}
              hideLabel
              options={getScheduleIntervals(scheduleIntervalValue)}
              defaultValue={CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT}
              required
              stacked
              inline={false}
              preserveOnUnmount
            />
          </Grid>
        </LayoutContainer>
      </InputGroup>
    );
  }

  return null;
}

function Margins() {
  return (
    <Fragment>
      <SubSectionSeparator aria-hidden="true" />
      <FormSectionSubHeading>{t('Set margins')}</FormSectionSubHeading>
      <InputGroup>
        <NumberField
          name="checkinMargin"
          min={CHECKIN_MARGIN_MINIMUM}
          placeholder={tn(
            'Defaults to %s minute',
            'Defaults to %s minutes',
            DEFAULT_CHECKIN_MARGIN
          )}
          help={t('Number of minutes before a check-in is considered missed.')}
          label={t('Grace Period')}
          defaultValue={DEFAULT_CHECKIN_MARGIN}
        />
        <NumberField
          name="maxRuntime"
          min={TIMEOUT_MINIMUM}
          max={MAX_RUNTIME_LIMIT}
          placeholder={tn(
            'Defaults to %s minute',
            'Defaults to %s minutes',
            DEFAULT_MAX_RUNTIME
          )}
          help={t(
            'Number of minutes before an in-progress check-in is marked timed out. The maximum is 10080 minutes (7 days).'
          )}
          label={t('Max Runtime')}
          defaultValue={DEFAULT_MAX_RUNTIME}
        />
      </InputGroup>
    </Fragment>
  );
}

function Thresholds() {
  return (
    <Fragment>
      <SubSectionSeparator aria-hidden="true" />
      <FormSectionSubHeading>{t('Set thresholds')}</FormSectionSubHeading>
      <InputGroup>
        <NumberField
          name="failureIssueThreshold"
          min={1}
          max={720}
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

export function CronDetectorFormDetectSection({step}: {step?: number}) {
  return (
    <Container>
      <FormSection step={step} title={t('Issue Detection')}>
        <DetectFieldsContainer>
          <div>
            <FieldGroup
              stacked
              flexibleControlStateSize
              label={t('Schedule')}
              id="scheduleType"
              help={tct(
                'You can use [link:the crontab syntax] or our interval schedule.',
                {link: <ExternalLink href="https://en.wikipedia.org/wiki/Cron" />}
              )}
            >
              <Schedule />
            </FieldGroup>
            <Margins />
            <Thresholds />
          </div>
        </DetectFieldsContainer>
      </FormSection>
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
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background-color: ${p => p.theme.tokens.border.primary};
`;

const InputGroup = styled('div')<{removeFieldPadding?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  ${p =>
    p.removeFieldPadding &&
    css`
      padding: 0;
    `}

  ${FieldWrapper} {
    ${p =>
      p.removeFieldPadding &&
      css`
        padding: 0;
      `}
  }
`;

const LabelText = styled(Text)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
`;

const CronstrueText = styled(LabelText)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.xs};
  font-family: ${p => p.theme.font.family.mono};
`;
