import {useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, KeyValueListData} from 'sentry/types/group';
import {IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';

interface EventRegressionSummaryProps {
  event: Event;
  group: Group;
}

export function EventRegressionSummary({event, group}: EventRegressionSummaryProps) {
  const organization = useOrganization();

  const data = useMemo(
    () => getKeyValueListData(organization, group.issueType, event),
    [organization, event, group.issueType]
  );

  if (!defined(data)) {
    return null;
  }

  return (
    <InterimSection type={SectionKey.REGRESSION_SUMMARY} title={t('Regression Summary')}>
      <StyledKeyValueList data={data} shouldSort={false} />
    </InterimSection>
  );
}

export function getKeyValueListData(
  organization: Organization,
  issueType: IssueType,
  event: Event
): KeyValueListData | null {
  const evidenceData = event.occurrence?.evidenceData;
  if (!defined(evidenceData)) {
    return null;
  }

  switch (issueType) {
    case IssueType.PERFORMANCE_DURATION_REGRESSION:
    case IssueType.PERFORMANCE_ENDPOINT_REGRESSION: {
      const target = transactionSummaryRouteWithQuery({
        organization,
        transaction: evidenceData.transaction,
        query: {},
        trendFunction: 'p95',
        projectID: event.projectID,
        display: DisplayModes.TREND,
      });
      return [
        {
          key: 'endpoint',
          subject: t('Endpoint Name'),
          value: evidenceData.transaction,
          actionButton: (
            <LinkButton size="xs" to={target}>
              {t('View Transaction')}
            </LinkButton>
          ),
        },
        {
          key: 'duration change',
          subject: t('Change in Duration'),
          value: formatDurationChange(
            evidenceData.aggregateRange1 / 1e3,
            evidenceData.aggregateRange2 / 1e3,
            evidenceData.trendDifference,
            evidenceData.trendPercentage
          ),
        },
        {
          key: 'regression date',
          subject: t('Approx. Start Time'),
          value: formatBreakpoint(evidenceData.breakpoint),
        },
      ];
    }
    case IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL:
    case IssueType.PROFILE_FUNCTION_REGRESSION: {
      return [
        {
          key: 'function',
          subject: t('Function Name'),
          value: evidenceData?.function || t('unknown'),
        },
        {
          key: 'package',
          subject: t('Package Name'),
          value: evidenceData.package || evidenceData.module || t('unknown'),
        },
        {
          key: 'file',
          subject: t('File Name'),
          value: evidenceData.file || t('unknown'),
        },
        {
          key: 'duration change',
          subject: t('Change in Duration'),
          value: formatDurationChange(
            evidenceData.aggregateRange1 / 1e9,
            evidenceData.aggregateRange2 / 1e9,
            evidenceData.trendDifference,
            evidenceData.trendPercentage
          ),
        },
        {
          key: 'breakpoint',
          subject: t('Approx. Start Time'),
          value: formatBreakpoint(evidenceData.breakpoint),
        },
      ];
    }
    default:
      return null;
  }
}

function formatDurationChange(
  before: number,
  after: number,
  difference: number,
  percentage: number
) {
  return t(
    '%s to %s (%s%s)',
    getDuration(before, 0, true),
    getDuration(after, 0, true),
    difference > 0 ? '+' : difference < 0 ? '-' : '',
    formatPercentage(percentage - 1)
  );
}

function formatBreakpoint(breakpoint: number) {
  return getFormattedDate(breakpoint * 1000, 'MMM D, YYYY hh:mm:ss A z', {
    local: true,
  });
}

const StyledKeyValueList = styled(KeyValueList)`
  margin-bottom: 0 !important;
`;
