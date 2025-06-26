import {useMemo} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {RepresentativeTraceEvent} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  isEAPError,
  isTraceError,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

type MetaDataProps = {
  bodyText: React.ReactNode;
  headingText: string;
  rightAlignBody?: boolean;
};

function MetaSection({headingText, bodyText, rightAlignBody}: MetaDataProps) {
  return (
    <HeaderInfo>
      <StyledSectionHeading>{headingText}</StyledSectionHeading>
      <SectionBody rightAlign={rightAlignBody}>{bodyText}</SectionBody>
    </HeaderInfo>
  );
}

const HeaderInfo = styled('div')`
  white-space: nowrap;
`;

const StyledSectionHeading = styled(SectionHeading)`
  font-size: ${p => p.theme.fontSize.sm};
  margin: 0;
`;

const SectionBody = styled('div')<{rightAlign?: boolean}>`
  font-size: ${p => p.theme.fontSize.xl};
  text-align: ${p => (p.rightAlign ? 'right' : 'left')};
  padding: ${space(0.5)} 0;
  max-height: 32px;
`;

interface MetaProps {
  logs: OurLogsResponseItem[] | undefined;
  meta: TraceMetaQueryResults['data'];
  organization: Organization;
  representativeEvent: RepresentativeTraceEvent;
  tree: TraceTree;
}

function getRootDuration(event: TraceTree.TraceEvent | null) {
  if (!event || isEAPError(event) || isTraceError(event)) {
    return '\u2014';
  }

  return getDuration(
    ('timestamp' in event ? event.timestamp : event.end_timestamp) -
      event.start_timestamp,
    2,
    true
  );
}

export function Meta(props: MetaProps) {
  const traceNode = props.tree.root.children[0]!;
  const {timestamp} = useTraceQueryParams();

  const uniqueErrorIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceTree.TraceErrorIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.errors) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniquePerformanceIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceTree.TraceOccurrence[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.occurrences) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniqueIssuesCount = uniqueErrorIssues.length + uniquePerformanceIssues.length;

  // If there is no trace data, use the timestamp from the query params as an approximation for
  // the age of the trace.
  const ageStartTimestamp =
    traceNode?.space[0] ?? (timestamp ? timestamp * 1000 : undefined);

  const hasSpans = (props.meta?.span_count ?? 0) > 0;
  const hasLogs = (props.logs?.length ?? 0) > 0;

  return (
    <MetaWrapper>
      <MetaSection
        headingText={t('Issues')}
        bodyText={
          uniqueIssuesCount > 0 ? (
            <TraceDrawerComponents.IssuesLink node={traceNode}>
              {uniqueIssuesCount}
            </TraceDrawerComponents.IssuesLink>
          ) : uniqueIssuesCount === 0 ? (
            0
          ) : (
            '\u2014'
          )
        }
      />
      {hasSpans ? (
        <MetaSection headingText={t('Spans')} bodyText={props.meta?.span_count} />
      ) : null}
      {ageStartTimestamp ? (
        <MetaSection
          headingText={t('Age')}
          bodyText={
            <TimeSince
              unitStyle="extraShort"
              date={new Date(ageStartTimestamp)}
              tooltipShowSeconds
              suffix=""
            />
          }
        />
      ) : null}
      {hasSpans ? (
        <MetaSection
          headingText={t('Root Duration')}
          rightAlignBody
          bodyText={getRootDuration(
            props.representativeEvent.event as TraceTree.TraceEvent
          )}
        />
      ) : hasLogs ? (
        <MetaSection
          rightAlignBody
          headingText={t('Logs')}
          bodyText={
            props.meta && 'logs' in props.meta
              ? props.meta.logs
              : (props.logs?.length ?? 0)
          }
        />
      ) : null}
    </MetaWrapper>
  );
}

const MetaWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};

  ${HeaderInfo} {
    min-height: 0;
  }

  ${SectionBody} {
    padding: 0;
  }
`;
