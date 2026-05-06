import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {withFieldGroup} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {
  FormSection,
  FormSectionSubHeading,
} from 'sentry/components/workflowEngine/ui/formSection';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct, tn} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {
  CRON_DEFAULT_CHECKIN_MARGIN,
  CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD,
  CRON_DEFAULT_MAX_RUNTIME,
  CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT,
  CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
  CRON_DEFAULT_SCHEDULE_TYPE,
  DEFAULT_CRONTAB,
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

export const CronDetectSection = withFieldGroup({
  defaultValues: {
    scheduleType: CRON_DEFAULT_SCHEDULE_TYPE as ScheduleType,
    scheduleCrontab: DEFAULT_CRONTAB,
    scheduleIntervalValue: CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
    scheduleIntervalUnit: CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT as string,
    timezone: 'UTC' as string,
    checkinMargin: CRON_DEFAULT_CHECKIN_MARGIN as number | null,
    maxRuntime: CRON_DEFAULT_MAX_RUNTIME as number | null,
    failureIssueThreshold: CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD,
  },
  props: {} as {step?: number},
  render: ({group, step}) => (
    <Container>
      <FormSection step={step} title={t('Issue Detection')}>
        <Stack gap="lg">
          <div>
            <FormSectionSubHeading>{t('Set your schedule')}</FormSectionSubHeading>
            <Text variant="muted">
              {tct('You can use [link:the crontab syntax] or our interval schedule.', {
                link: <ExternalLink href="https://en.wikipedia.org/wiki/Cron" />,
              })}
            </Text>

            <group.AppField name="scheduleType">
              {scheduleTypeField => (
                <ScheduleFields
                  scheduleType={scheduleTypeField.state.value}
                  scheduleTypeField={scheduleTypeField}
                  group={group}
                />
              )}
            </group.AppField>
          </div>

          <SubSectionSeparator aria-hidden="true" />
          <FormSectionSubHeading>{t('Set margins')}</FormSectionSubHeading>
          <Stack gap="md">
            <group.AppField name="checkinMargin">
              {field => (
                <field.Layout.Row
                  label={t('Grace Period')}
                  hintText={t(
                    'Number of minutes before a check-in is considered missed.'
                  )}
                >
                  <field.Input
                    type="number"
                    value={
                      field.state.value === null || field.state.value === undefined
                        ? ''
                        : String(field.state.value)
                    }
                    onChange={val => field.handleChange(val === '' ? null : Number(val))}
                    min={CHECKIN_MARGIN_MINIMUM}
                    placeholder={tn(
                      'Defaults to %s minute',
                      'Defaults to %s minutes',
                      CRON_DEFAULT_CHECKIN_MARGIN
                    )}
                  />
                </field.Layout.Row>
              )}
            </group.AppField>
            <group.AppField name="maxRuntime">
              {field => (
                <field.Layout.Row
                  label={t('Max Runtime')}
                  hintText={t(
                    'Number of minutes before an in-progress check-in is marked timed out.'
                  )}
                >
                  <field.Input
                    type="number"
                    value={
                      field.state.value === null || field.state.value === undefined
                        ? ''
                        : String(field.state.value)
                    }
                    onChange={val => field.handleChange(val === '' ? null : Number(val))}
                    min={TIMEOUT_MINIMUM}
                    placeholder={tn(
                      'Defaults to %s minute',
                      'Defaults to %s minutes',
                      CRON_DEFAULT_MAX_RUNTIME
                    )}
                  />
                </field.Layout.Row>
              )}
            </group.AppField>
          </Stack>

          <SubSectionSeparator aria-hidden="true" />
          <FormSectionSubHeading>{t('Set thresholds')}</FormSectionSubHeading>
          <group.AppField name="failureIssueThreshold">
            {field => (
              <field.Layout.Row
                label={t('Failure Tolerance')}
                hintText={t(
                  'Create a new issue when this many consecutive missed or error check-ins are processed.'
                )}
              >
                <field.Number
                  value={field.state.value}
                  onChange={field.handleChange}
                  min={1}
                  max={720}
                  placeholder="1"
                />
              </field.Layout.Row>
            )}
          </group.AppField>
        </Stack>
      </FormSection>
    </Container>
  ),
});

function ScheduleFields({
  scheduleType,
  scheduleTypeField,
  group,
}: {
  group: any;
  scheduleType: ScheduleType;
  scheduleTypeField: any;
}) {
  const theme = useTheme();
  const isCrontab = scheduleType === ScheduleType.CRONTAB;
  const isInterval = scheduleType === ScheduleType.INTERVAL;

  return (
    <Stack gap="md" padding="xl 0 0 0">
      <scheduleTypeField.Select
        value={scheduleTypeField.state.value}
        onChange={scheduleTypeField.handleChange}
        options={SCHEDULE_OPTIONS}
      />
      {isCrontab && (
        <group.AppField name="scheduleCrontab">
          {(crontabField: any) => {
            const parsed = crontabAsText(crontabField.state.value);
            return (
              <MultiColumnInput columns="1fr 2fr">
                <crontabField.Input
                  value={crontabField.state.value}
                  onChange={crontabField.handleChange}
                  placeholder="* * * * *"
                  css={css`
                    input {
                      font-family: ${theme.font.family.mono};
                    }
                  `}
                />
                <group.AppField name="timezone">
                  {(tzField: any) => (
                    <tzField.Select
                      value={tzField.state.value}
                      onChange={tzField.handleChange}
                      options={timezoneOptions}
                    />
                  )}
                </group.AppField>
                {parsed && <CronstrueText>"{parsed}"</CronstrueText>}
              </MultiColumnInput>
            );
          }}
        </group.AppField>
      )}
      {isInterval && (
        <group.AppField name="scheduleIntervalValue">
          {(valueField: any) => (
            <MultiColumnInput columns="auto 1fr 2fr">
              <LabelText>{t('Every')}</LabelText>
              <valueField.Number
                value={valueField.state.value}
                onChange={valueField.handleChange}
                placeholder="e.g. 1"
                min={1}
              />
              <group.AppField name="scheduleIntervalUnit">
                {(unitField: any) => (
                  <unitField.Select
                    value={unitField.state.value}
                    onChange={unitField.handleChange}
                    options={getScheduleIntervals(valueField.state.value)}
                  />
                )}
              </group.AppField>
            </MultiColumnInput>
          )}
        </group.AppField>
      )}
    </Stack>
  );
}

const SubSectionSeparator = styled('hr')`
  height: 1px;
  border: none;
  margin: 0;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background-color: ${p => p.theme.tokens.border.primary};
`;

const LabelText = styled(Text)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
`;

const MultiColumnInput = styled('div')<{columns?: string}>`
  display: grid;
  align-items: center;
  gap: ${p => p.theme.space.md};
  grid-template-columns: ${p => p.columns};
`;

const CronstrueText = styled(LabelText)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.xs};
  font-family: ${p => p.theme.font.family.mono};
  grid-column: auto / span 2;
`;
