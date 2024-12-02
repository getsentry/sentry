import {useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import Link from 'sentry/components/links/link';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useTraceAverageTransactionDuration} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceAverageTransactionDuration';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {TraceDrawerComponents} from '../../styles';

type HighlightProps = {
  event: EventTransaction;
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
  project: Project | undefined;
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

  if (!isTransactionNode(props.node)) {
    return null;
  }

  const headerContent = (
    <HeaderContentWrapper>
      <TextWrapper>{props.node.value.transaction}</TextWrapper>
      <CopyToClipboardButton
        borderless
        size="zero"
        iconSize="xs"
        text={props.node.value.transaction}
        tooltipProps={{disabled: true}}
      />
    </HeaderContentWrapper>
  );

  const bodyContent = (
    <BodyContentWrapper>
      <Link
        to={transactionSummaryRouteWithQuery({
          orgSlug: props.organization.slug,
          transaction: props.node.value.transaction,
          // Omit the query from the target url, as we dont know where it may have came from
          // and if its syntax is supported on the target page. In this example, txn search does
          // not support is:filter type expressions (and possibly other expressions we dont know about)
          query: omit(location.query, Object.values(PAGE_URL_PARAM).concat('query')),
          projectID: String(props.node.value.project_id),
        })}
      >
        <StyledIconGraph type="area" size="xs" />
        {t('View transaction summary')}
      </Link>
    </BodyContentWrapper>
  );

  return (
    <TraceDrawerComponents.Highlights
      node={props.node}
      transaction={props.event}
      project={props.project}
      avgDuration={avgDurationInSeconds}
      headerContent={headerContent}
      bodyContent={bodyContent}
    />
  );
}

const StyledIconGraph = styled(IconGraph)`
  margin-right: ${space(1)};
`;

const HeaderContentWrapper = styled('div')`
  padding: ${space(1)};
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
`;

const BodyContentWrapper = styled('div')`
  padding: ${space(1)};
`;

const TextWrapper = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${p => p.theme.overflowEllipsis};
`;
