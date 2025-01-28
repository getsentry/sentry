import {useMemo} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import type {
  TraceErrorOrIssue,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

import {TraceDrawerComponents} from '../traceDrawer/details/styles';
import type {TraceTree} from '../traceModels/traceTree';

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
  font-size: ${p => p.theme.fontSizeSmall};
  margin: 0;
`;

const SectionBody = styled('div')<{rightAlign?: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  text-align: ${p => (p.rightAlign ? 'right' : 'left')};
  padding: ${space(0.5)} 0;
  max-height: 32px;
`;

interface MetaProps {
  meta: TraceMeta | undefined;
  organization: Organization;
  representativeTransaction: TraceTree.Transaction | null;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  tree: TraceTree;
}

export function Meta(props: MetaProps) {
  const traceNode = props.tree.root.children[0]!;

  const uniqueErrorIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceErrorOrIssue[] = [];
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

    const unique: TraceErrorOrIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.performance_issues) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniqueIssuesCount = uniqueErrorIssues.length + uniquePerformanceIssues.length;

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
      <MetaSection
        headingText={t('Events')}
        bodyText={(props.meta?.transactions ?? 0) + (props.meta?.errors ?? 0)}
      />
      {traceNode ? (
        <MetaSection
          headingText={t('Age')}
          bodyText={
            <TimeSince
              unitStyle="extraShort"
              date={new Date(traceNode.space[0])}
              tooltipShowSeconds
              suffix=""
            />
          }
        />
      ) : null}
      {traceNode ? (
        <MetaSection
          headingText={t('Root Duration')}
          rightAlignBody
          bodyText={
            props.representativeTransaction
              ? getDuration(
                  props.representativeTransaction.timestamp -
                    props.representativeTransaction.start_timestamp,
                  2,
                  true
                )
              : '\u2014'
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
