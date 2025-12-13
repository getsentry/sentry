import {useMemo} from 'react';
import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {SpanFields} from 'sentry/views/insights/types';
import {
  TraceDrawerComponents,
  type SectionCardKeyValueList,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

export function useSpanAncestryAndGroupingItems({
  node,
  onParentClick,
}: {
  location: Location;
  node: SpanNode;
  onParentClick: (node: BaseNode) => void;
  organization: Organization;
}): SectionCardKeyValueList {
  const parentTransaction = useMemo(() => node.findClosestParentTransaction(), [node]);
  const childTransactions = useMemo(() => {
    const transactions: TransactionNode[] = [];
    node.forEachChild(c => {
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
          {parentTransaction.drawerTabsTitle}
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

  if (span.same_process_as_parent) {
    items.push({
      key: 'same_process_as_parent',
      value: String(span.same_process_as_parent),
      subject: t('Same Process as Parent'),
    });
  }

  const childTransaction = childTransactions[0];
  const spanGroup = defined(span.hash) ? String(span.hash) : null;
  items.push({
    key: 'same_group',
    value: spanGroup,
    subject: t('Span Group'),
    actionButton: (
      <TraceDrawerComponents.KeyValueAction
        rowKey={SpanFields.SPAN_GROUP}
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
