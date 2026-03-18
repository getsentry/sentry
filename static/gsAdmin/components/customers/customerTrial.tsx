import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {CodeBlock} from '@sentry/scraps/code';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {
  TimeRangeSelector,
  TimeRangeSelectTrigger,
  type ChangeData,
} from 'sentry/components/timeRangeSelector';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {Contract, ContractDate, Trial} from 'admin/types';

function contractDateToMoment(d?: ContractDate): moment.Moment | undefined {
  if (!d?.year || !d?.month || !d?.day) {
    return undefined;
  }
  return moment({year: d.year, month: d.month - 1, day: d.day});
}

export function CustomerTrial({orgId}: {orgId: string}) {
  const [dateRange, setDateRange] = useState<{
    end: Date | null;
    start: Date | null;
  }>({start: null, end: null});

  const contractQuery = useApiQuery<Contract>(
    [
      getApiUrl(`/_admin/customers/$organizationIdOrSlug/contract/`, {
        path: {organizationIdOrSlug: orgId},
      }),
    ],
    {
      staleTime: 0,
    }
  );

  const billingStart = useMemo(
    () => contractDateToMoment(contractQuery.data?.pricingConfig?.billingPeriodStartDate),
    [contractQuery.data]
  );
  const billingEnd = useMemo(
    () => contractDateToMoment(contractQuery.data?.pricingConfig?.billingPeriodEndDate),
    [contractQuery.data]
  );

  const startDate = dateRange.start
    ? moment(dateRange.start).format('YYYY-MM-DD')
    : billingStart?.format('YYYY-MM-DD');
  const endDate = dateRange.end
    ? moment(dateRange.end).format('YYYY-MM-DD')
    : billingEnd?.format('YYYY-MM-DD');

  const trialQuery = useApiQuery<Trial>(
    [
      getApiUrl(`/_admin/customers/$organizationIdOrSlug/trials/`, {
        path: {organizationIdOrSlug: orgId},
      }),
      {query: {...(startDate && {startDate}), ...(endDate && {endDate})}},
    ],
    {
      staleTime: 0,
      enabled: !contractQuery.isPending,
    }
  );

  const handleDateChange = (datetime: ChangeData) => {
    const {start, end} = datetime;
    if (start && end) {
      setDateRange({start: new Date(start), end: new Date(end)});
    }
  };

  if (contractQuery.isPending) {
    return <LoadingIndicator />;
  }

  if (contractQuery.isError) {
    return <LoadingError onRetry={contractQuery.refetch} />;
  }

  return (
    <Flex direction="column" gap="lg">
      <Flex>
        <DateTimeRange
          trigger={triggerProps => (
            <TimeRangeSelectTrigger {...triggerProps} prefix="Date Range" />
          )}
          relative=""
          start={dateRange.start ?? billingStart?.toDate() ?? null}
          end={dateRange.end ?? billingEnd?.toDate() ?? null}
          utc={null}
          onChange={handleDateChange}
          showRelative={false}
        />
      </Flex>
      {trialQuery.isPending ? (
        <LoadingIndicator />
      ) : trialQuery.isError ? (
        <LoadingError onRetry={trialQuery.refetch} />
      ) : trialQuery.data ? (
        <Panel>
          <PanelBody withPadding>
            <Disclosure>
              <Disclosure.Title>Raw Trial Response</Disclosure.Title>
              <Disclosure.Content>
                <CodeBlock language="json">
                  {JSON.stringify(trialQuery.data, null, 2)}
                </CodeBlock>
              </Disclosure.Content>
            </Disclosure>
          </PanelBody>
        </Panel>
      ) : null}
    </Flex>
  );
}

const DateTimeRange = styled(TimeRangeSelector)`
  white-space: nowrap;
`;
