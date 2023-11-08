import {useMemo} from 'react';

import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {DataSection} from 'sentry/components/events/styles';
import {t} from 'sentry/locale';
import {Event, Group, IssueType, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';

interface EventRegressionSummaryProps {
  event: Event;
  group: Group;
}

export function EventRegressionSummary({event, group}: EventRegressionSummaryProps) {
  const data = useMemo(() => getKeyValueListData(group, event), [event, group]);

  if (!defined(data)) {
    return null;
  }

  return (
    <DataSection>
      <KeyValueList data={data} shouldSort={false} />
    </DataSection>
  );
}

function getKeyValueListData(group: Group, event: Event): KeyValueListData | null {
  const evidenceData = event.occurrence?.evidenceData;
  if (!defined(evidenceData)) {
    return null;
  }

  switch (group.issueType) {
    case IssueType.PERFORMANCE_DURATION_REGRESSION:
    case IssueType.PERFORMANCE_ENDPOINT_REGRESSION: {
      return [
        {
          key: 'endpoint',
          subject: t('Endpoint Name'),
          value: evidenceData.transaction,
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
