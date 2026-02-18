import {Fragment, useMemo, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconMail} from 'sentry/icons/iconMail';
import {t} from 'sentry/locale';
import type {Member, Organization} from 'sentry/types/organization';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import {useUser} from 'sentry/utils/useUser';

const VALID_TIME_RANGES = ['1h', '1d', '24h', '7d', '14d', '30d', '90d'] as const;

const TIME_RANGE_OPTIONS = VALID_TIME_RANGES.map(value => ({
  value,
  label: {
    '1h': t('Last 1 hour'),
    '1d': t('Last 1 day'),
    '24h': t('Last 24 hours'),
    '7d': t('Last 7 days'),
    '14d': t('Last 14 days'),
    '30d': t('Last 30 days'),
    '90d': t('Last 90 days'),
  }[value],
}));

const DAY_OF_WEEK_OPTIONS = [
  {value: 0, label: t('Monday')},
  {value: 1, label: t('Tuesday')},
  {value: 2, label: t('Wednesday')},
  {value: 3, label: t('Thursday')},
  {value: 4, label: t('Friday')},
  {value: 5, label: t('Saturday')},
  {value: 6, label: t('Sunday')},
];

const DAY_OF_MONTH_OPTIONS = Array.from({length: 31}, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

function getHourOptions(): Array<{label: string; value: number}> {
  const options: Array<{label: string; value: number}> = [];
  const userTimezoneOffset = new Date().getTimezoneOffset();

  for (let localHour = 0; localHour < 24; localHour++) {
    const date = new Date();
    date.setHours(localHour, 0, 0, 0);
    const localLabel = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    // Convert local hour to UTC hour
    const utcHour = (((localHour + userTimezoneOffset / 60) % 24) + 24) % 24;

    options.push({
      value: Math.round(utcHour) % 24,
      label: localLabel,
    });
  }

  return options;
}

function getDefaultHourUtc(): number {
  const userTimezoneOffset = new Date().getTimezoneOffset();
  // Default to 9 AM local time, converted to UTC
  return (((9 + userTimezoneOffset / 60) % 24) + 24) % 24;
}

export type ScheduleReportModalProps = ModalRenderProps & {
  organization: Organization;
  sourceId: number;
  sourceName: string;
  sourceType: 'explore_saved_query' | 'dashboard';
  isMultiQuery?: boolean;
};

export default function ScheduleReportModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  sourceType,
  sourceId,
  sourceName,
  isMultiQuery,
}: ScheduleReportModalProps) {
  const user = useUser();

  const [name, setName] = useState(sourceName);
  const [frequency, setFrequency] = useState<string>('daily');
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [hour, setHour] = useState<number>(Math.round(getDefaultHourUtc()) % 24);
  const [timeRange, setTimeRange] = useState<string | null>(null);
  const [recipientEmails, setRecipientEmails] = useState<string[]>(
    user.email ? [user.email] : []
  );

  const hourOptions = useMemo(() => getHourOptions(), []);

  // Fetch org members for recipient autocomplete
  const {data: members, isPending: membersLoading} = useApiQuery<Member[]>(
    [`/organizations/${organization.slug}/members/`],
    {
      staleTime: 30000,
    }
  );

  const memberEmailOptions = useMemo(() => {
    if (!members) {
      return [];
    }
    return members
      .filter(member => member.email && !member.pending)
      .map(member => ({
        value: member.email,
        label: member.name ? `${member.name} (${member.email})` : member.email,
      }));
  }, [members]);

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      name,
      sourceType,
      sourceId,
      frequency,
      hour,
      recipientEmails,
    };

    if (frequency === 'weekly') {
      payload.dayOfWeek = dayOfWeek;
    }

    if (frequency === 'monthly') {
      payload.dayOfMonth = dayOfMonth;
    }

    if (timeRange) {
      payload.timeRange = timeRange;
    }

    return payload;
  }

  const scheduleMutation = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organization.slug}/scheduled-reports/`,
        method: 'POST',
        data: buildPayload(),
      }),
    onSuccess: () => {
      addSuccessMessage(t('Report scheduled successfully'));
      closeModal();
    },
    onError: () => {
      addErrorMessage(t('Failed to schedule report'));
    },
  });

  const testSendMutation = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organization.slug}/scheduled-reports/test/`,
        method: 'POST',
        data: buildPayload(),
      }),
    onSuccess: () => {
      addSuccessMessage(t('Test email sent'));
    },
    onError: () => {
      addErrorMessage(t('Failed to send test email'));
    },
  });

  const isValid = name.trim().length > 0 && recipientEmails.length > 0;
  const isScheduling = scheduleMutation.isPending;
  const isSendingTest = testSendMutation.isPending;

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{t('Schedule Report')}</Heading>
      </Header>
      <Body>
        <Flex direction="column" gap="lg">
          {isMultiQuery && (
            <Alert variant="warning" showIcon>
              {t('Only the first query will be included in the report.')}
            </Alert>
          )}

          <Flex direction="column" gap="xs">
            <Text as="label" bold>
              {t('Report Name')}
            </Text>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('Enter a name for the report')}
            />
          </Flex>

          <Flex direction="column" gap="xs">
            <Text as="label" bold>
              {t('Frequency')}
            </Text>
            <RadioGroup
              label={t('Frequency')}
              value={frequency}
              onChange={id => setFrequency(id)}
              choices={[
                ['daily', t('Daily')],
                ['weekly', t('Weekly')],
                ['monthly', t('Monthly')],
              ]}
              orientInline
            />
          </Flex>

          <Flex direction="column" gap="xs">
            <Text as="label" bold>
              {t('Recipients')}
            </Text>
            {membersLoading ? (
              <LoadingIndicator mini />
            ) : (
              <CompactSelect
                multiple
                value={recipientEmails}
                onChange={options => setRecipientEmails(options.map(opt => opt.value))}
                options={memberEmailOptions}
                searchable
              />
            )}
          </Flex>

          <Disclosure defaultExpanded={false}>
            <Disclosure.Title>{t('Advanced Options')}</Disclosure.Title>
            <Disclosure.Content>
              <Flex direction="column" gap="lg" padding="sm 0 0 0">
                {frequency === 'weekly' && (
                  <Flex direction="column" gap="xs">
                    <Text as="label" bold>
                      {t('Day of Week')}
                    </Text>
                    <CompactSelect
                      value={dayOfWeek}
                      onChange={option => setDayOfWeek(option.value)}
                      options={DAY_OF_WEEK_OPTIONS}
                    />
                  </Flex>
                )}

                {frequency === 'monthly' && (
                  <Flex direction="column" gap="xs">
                    <Text as="label" bold>
                      {t('Day of Month')}
                    </Text>
                    <CompactSelect
                      value={dayOfMonth}
                      onChange={option => setDayOfMonth(option.value)}
                      options={DAY_OF_MONTH_OPTIONS}
                    />
                  </Flex>
                )}

                <Flex direction="column" gap="xs">
                  <Text as="label" bold>
                    {t('Time')}
                  </Text>
                  <CompactSelect
                    value={hour}
                    onChange={option => setHour(option.value)}
                    options={hourOptions}
                    searchable
                  />
                </Flex>

                <Flex direction="column" gap="xs">
                  <Text as="label" bold>
                    {t('Time Range')}
                  </Text>
                  <CompactSelect
                    value={timeRange ?? ''}
                    onChange={option =>
                      setTimeRange(option.value === '' ? null : option.value)
                    }
                    options={[
                      {value: '', label: t('Use saved query default')},
                      ...TIME_RANGE_OPTIONS,
                    ]}
                  />
                </Flex>
              </Flex>
            </Disclosure.Content>
          </Disclosure>
        </Flex>
      </Body>

      <Footer>
        <Flex justify="between" width="100%">
          <Button
            onClick={() => testSendMutation.mutate()}
            disabled={!isValid || isScheduling}
            busy={isSendingTest}
            icon={<IconMail />}
          >
            {isSendingTest ? t('Sending...') : t('Send Test Email')}
          </Button>
          <Flex gap="md">
            <Button onClick={closeModal} disabled={isScheduling}>
              {t('Cancel')}
            </Button>
            <Button
              priority="primary"
              onClick={() => scheduleMutation.mutate()}
              disabled={!isValid || isScheduling || isSendingTest}
            >
              {isScheduling ? t('Scheduling...') : t('Schedule Report')}
            </Button>
          </Flex>
        </Flex>
      </Footer>
    </Fragment>
  );
}
