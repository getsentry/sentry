import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {SpanEntryContext} from 'sentry/components/events/interfaces/spans/context';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {
  type SectionCardKeyValueList,
  TraceDrawerComponents,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

type TransactionResult = {
  id: string;
  'project.name': string;
  'trace.span': string;
  transaction: string;
};

function SpanChild({
  childTransaction,
  organization,
  location,
}: {
  childTransaction: TraceTreeNode<TraceTree.Transaction>;
  location: Location;
  organization: Organization;
}) {
  const transactionResult: TransactionResult = {
    'project.name': childTransaction.value.project_slug,
    transaction: childTransaction.value.transaction,
    'trace.span': childTransaction.value.span_id,
    id: childTransaction.value.event_id,
  };

  const eventSlug = generateEventSlug({
    id: transactionResult.id,
    'project.name': transactionResult['project.name'],
  });

  const value = (
    <SpanEntryContext.Consumer>
      {({getViewChildTransactionTarget}) => {
        const to = getViewChildTransactionTarget({
          ...transactionResult,
          eventSlug,
        });

        if (!to) {
          return `${transactionResult.transaction} (${transactionResult['project.name']})`;
        }

        const target = transactionSummaryRouteWithQuery({
          organization,
          transaction: transactionResult.transaction,
          query: omit(location.query, Object.values(PAGE_URL_PARAM)),
          projectID: String(childTransaction.value.project_id),
        });

        return (
          <SpanChildValueWrapper>
            <Link data-test-id="view-child-transaction" to={to}>
              {`${transactionResult.transaction} (${transactionResult['project.name']})`}
            </Link>
            <LinkButton size="xs" to={target}>
              {t('View Summary')}
            </LinkButton>
          </SpanChildValueWrapper>
        );
      }}
    </SpanEntryContext.Consumer>
  );

  return value;
}

export function useSpanAncestryAndGroupingItems({
  node,
  onParentClick,
  location,
  organization,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
}): SectionCardKeyValueList {
  const parentTransaction = useMemo(() => TraceTree.ParentTransaction(node), [node]);
  const childTransactions = useMemo(() => {
    const transactions: Array<TraceTreeNode<TraceTree.Transaction>> = [];
    TraceTree.ForEachChild(node, c => {
      if (isTransactionNode(c)) {
        transactions.push(c);
      }
    });
    return transactions;
  }, [node]);
  const span = node.value;
  const items: SectionCardKeyValueList = [];

  if (parentTransaction) {
    items.push({
      key: 'parent_transaction',
      value: (
        <a href="#" onClick={() => onParentClick(parentTransaction)}>
          {getTraceTabTitle(parentTransaction)}
        </a>
      ),
      subject: t('Parent Transaction'),
    });
  }

  items.push({
    key: 'origin',
    value: span.origin === undefined ? null : String(span.origin),
    subject: t('Origin'),
  });

  items.push({
    key: 'parent_span_id',
    value: node.parent ? (
      <a href="#" onClick={() => onParentClick(node.parent!)}>
        {span.parent_span_id || ''}
      </a>
    ) : (
      span.parent_span_id || ''
    ),
    subject: t('Parent Span ID'),
  });

  const childTransaction = childTransactions[0];
  if (childTransaction) {
    items.push({
      key: 'child_transaction',
      value: (
        <SpanChild
          childTransaction={childTransaction}
          organization={organization}
          location={location}
        />
      ),
      subject: t('Child Transaction'),
    });
  }

  if (span.same_process_as_parent) {
    items.push({
      key: 'same_process_as_parent',
      value: String(span.same_process_as_parent),
      subject: t('Same Process as Parent'),
    });
  }

  const spanGroup = defined(span.hash) ? String(span.hash) : null;
  items.push({
    key: 'same_group',
    value: spanGroup,
    subject: t('Span Group'),
    actionButton: (
      <TraceDrawerComponents.KeyValueAction
        rowKey={SpanIndexedField.SPAN_GROUP}
        rowValue={spanGroup}
        projectIds={
          childTransaction ? String(childTransaction.value.project_id) : undefined
        }
      />
    ),
    actionButtonAlwaysVisible: true,
  });

  return items;
}

const SpanChildValueWrapper = styled(TraceDrawerComponents.FlexBox)`
  justify-content: space-between;
  gap: ${space(0.5)};
`;
