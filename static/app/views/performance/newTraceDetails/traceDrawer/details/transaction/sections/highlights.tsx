import {useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Link} from 'sentry/components/core/link';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useTraceAverageTransactionDuration} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceAverageTransactionDuration';
import {getHighlightedSpanAttributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/highlightedAttributes';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

type HighlightProps = {
  event: EventTransaction;
  node: TransactionNode;
  organization: Organization;
  project: Project | undefined;
  hideNodeActions?: boolean;
};

export function TransactionHighlights(props: HighlightProps) {
  const location = useLocation();

  const {data: averageDurationQueryResult} = useTraceAverageTransactionDuration({
    node: props.node,
    location,
    organization: props.organization,
  });

  const avgDurationInSeconds: number = useMemo(() => {
    return (
      Number(averageDurationQueryResult?.data?.[0]?.['avg(transaction.duration)']) / 1000
    );
  }, [averageDurationQueryResult]);

  const headerContent = (
    <HeaderContentWrapper>
      <span>{props.node.value.transaction}</span>
      <CopyToClipboardButton
        borderless
        size="zero"
        aria-label={t('Copy transaction name to clipboard')}
        text={props.node.value.transaction}
        tooltipProps={{disabled: true}}
      />
    </HeaderContentWrapper>
  );

  const bodyContent = (
    <BodyContentWrapper>
      <StyledLink
        to={transactionSummaryRouteWithQuery({
          organization: props.organization,
          transaction: props.node.value.transaction,
          // Omit the query from the target url, as we dont know where it may have came from
          // and if its syntax is supported on the target page. In this example, txn search does
          // not support is:filter type expressions (and possibly other expressions we dont know about)
          query: omit(location.query, Object.values(PAGE_URL_PARAM).concat('query')),
          projectID: String(props.node.value.project_id),
        })}
      >
        <IconGraph type="area" size="xs" />
        {t('View Summary')}
      </StyledLink>
    </BodyContentWrapper>
  );

  return (
    <TraceDrawerComponents.Highlights
      node={props.node}
      project={props.project}
      avgDuration={avgDurationInSeconds}
      headerContent={headerContent}
      bodyContent={bodyContent}
      footerContent={<TraceDrawerComponents.HighLightsOpsBreakdown event={props.event} />}
      hideNodeActions={props.hideNodeActions}
      comparisonDescription={t(
        'Average duration for this transaction over the last 24 hours'
      )}
      highlightedAttributes={getHighlightedSpanAttributes({
        attributes: props.event.contexts.trace?.data,
        spanId: props.node.value.span_id,
        op: props.node.value['transaction.op'],
      })}
    />
  );
}

const HeaderContentWrapper = styled('div')`
  padding: ${space(1)};
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  word-break: break-word;
  line-height: 1.4;
`;

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const BodyContentWrapper = styled('div')`
  padding: ${space(1)};
`;
