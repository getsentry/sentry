import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

type MetaDataProps = {
  children: React.ReactNode;
  headingText: string;
  rightAlignBody?: boolean;
};

function MetaSection({headingText, rightAlignBody, children}: MetaDataProps) {
  return (
    <HeaderInfo>
      <StyledSectionHeading>{headingText}</StyledSectionHeading>
      <SectionBody alignment={rightAlignBody}>{children}</SectionBody>
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

const SectionBody = styled('div')<{alignment?: boolean}>`
  font-size: ${p => p.theme.fontSize.xl};
  text-align: ${p => (p.alignment ? 'right' : 'left')};
  padding: ${p => p.theme.space.xs} 0;
  max-height: 32px;
`;

interface MetaProps {
  logs: OurLogsResponseItem[] | undefined;
  meta: TraceMetaQueryResults['data'];
  metrics: {count: number} | undefined;
  organization: Organization;
  representativeEvent: TraceTree.RepresentativeTraceEvent | null;
  tree: TraceTree;
}

function getRootDuration(node: BaseNode | null) {
  if (!node) {
    return '\u2014';
  }

  const startTimestamp = node.startTimestamp;
  const endTimestamp = node.endTimestamp;

  if (!startTimestamp || !endTimestamp) {
    return '\u2014';
  }

  return getDuration(endTimestamp - startTimestamp, 2, true);
}

export function Meta(props: MetaProps) {
  const traceNode = props.tree.root.children[0];
  const {timestamp} = useTraceQueryParams();

  const spansCount =
    props.tree.eap_spans_count > 0
      ? props.tree.eap_spans_count
      : (props.meta?.span_count ?? 0);

  const uniqueIssuesCount = traceNode ? traceNode.uniqueIssues.length : 0;

  // If there is no trace data, use the timestamp from the query params as an approximation for
  // the age of the trace.
  const ageStartTimestamp =
    traceNode?.space[0] ?? (timestamp ? timestamp * 1000 : undefined);

  const hasSpans = spansCount > 0;
  const hasLogs = (props.logs?.length ?? 0) > 0;

  const repEvent = props.representativeEvent?.event;

  return (
    <MetaWrapper>
      <MetaSection headingText={t('Issues')}>
        {uniqueIssuesCount && traceNode ? (
          <TraceDrawerComponents.IssuesLink node={traceNode}>
            {uniqueIssuesCount}
          </TraceDrawerComponents.IssuesLink>
        ) : (
          uniqueIssuesCount
        )}
      </MetaSection>
      {hasSpans ? <MetaSection headingText={t('Spans')}>{spansCount}</MetaSection> : null}
      {ageStartTimestamp ? (
        <MetaSection headingText={t('Age')}>
          <TimeSince
            unitStyle="extraShort"
            date={new Date(ageStartTimestamp)}
            tooltipShowSeconds
            suffix=""
          />
        </MetaSection>
      ) : null}
      {hasSpans ? (
        <MetaSection headingText={t('Root Duration')} rightAlignBody>
          {repEvent
            ? OurLogKnownFieldKey.PROJECT_ID in repEvent
              ? '\u2014' // Logs don't have a duration
              : getRootDuration(repEvent)
            : '\u2014'}
        </MetaSection>
      ) : hasLogs ? (
        <MetaSection rightAlignBody headingText={t('Logs')}>
          {props.meta && 'logs' in props.meta
            ? props.meta.logs
            : (props.logs?.length ?? 0)}
        </MetaSection>
      ) : null}
    </MetaWrapper>
  );
}

const MetaWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xl};

  ${HeaderInfo} {
    min-height: 0;
  }

  ${SectionBody} {
    padding: 0;
  }
`;
