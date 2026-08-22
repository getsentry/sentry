import {useMemo} from 'react';
import styled from '@emotion/styled';

import {KeyValueList} from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, KeyValueListData} from 'sentry/types/group';
import {IssueType} from 'sentry/types/group';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

interface EventRegressionSummaryProps {
  event: Event;
  group: Group;
}

export function EventRegressionSummary({event, group}: EventRegressionSummaryProps) {
  const data = useMemo(
    () => getKeyValueListData(group.issueType, event),
    [event, group.issueType]
  );

  if (!defined(data)) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.REGRESSION_SUMMARY}
      title={t('Regression Summary')}
    >
      <StyledKeyValueList data={data} shouldSort={false} />
    </FoldSection>
  );
}

export function keyValueListDataToMarkdownLines(data: KeyValueListData): string[] {
  return data
    .map(item => {
      const raw = item.value;
      const value =
        typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
      if (!item.subject || value === '') {
        return null;
      }
      return `**${item.subject}:** ${value}`;
    })
    .filter((line): line is string => line !== null);
}

export function getKeyValueListData(
  issueType: IssueType,
  event: Event
): KeyValueListData | null {
  const evidenceData = event.occurrence?.evidenceData;
  if (!defined(evidenceData)) {
    return null;
  }

  switch (issueType) {
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
  return getFormattedDate(
    breakpoint * 1000,
    getFormat({year: true, seconds: true, timeZone: true}),
    {local: true}
  );
}

const StyledKeyValueList = styled(KeyValueList)`
  margin-bottom: 0 !important;
`;
