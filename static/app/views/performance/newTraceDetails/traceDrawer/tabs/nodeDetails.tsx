import styled from '@emotion/styled';
import type {Location} from 'history';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';

import {
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../../guards';
import type {TraceTree, TraceTreeNode} from '../../traceTree';
import ErrorNodeDetails from '../details/errorNodeDetails';
import MissingInstrumentationNodeDetails from '../details/missingInstrumentaionNodeDetails';
import ParentAutogroupNodeDetails from '../details/parentAutogroupNodeDetails';
import SiblingAutogroupNodeDetails from '../details/siblingAutogroupNodeDetails';
import SpanNodeDetails from '../details/spanNodeDetails';
import TransactionNodeDetails from '../details/transactionNodeDetails';

export default function NodeDetail({
  node,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  organization: Organization;
}) {
  if (!node) {
    return <NoDetail>{t('Click on a row in the trace view for its details')}</NoDetail>;
  }

  return isTransactionNode(node) ? (
    <TransactionNodeDetails node={node} organization={organization} location={location} />
  ) : isSpanNode(node) ? (
    <SpanNodeDetails node={node} organization={organization} />
  ) : isTraceErrorNode(node) ? (
    <ErrorNodeDetails node={node} organization={organization} />
  ) : isParentAutogroupedNode(node) ? (
    <ParentAutogroupNodeDetails node={node} />
  ) : isSiblingAutogroupedNode(node) ? (
    <SiblingAutogroupNodeDetails node={node} />
  ) : isMissingInstrumentationNode(node) ? (
    <MissingInstrumentationNodeDetails node={node} />
  ) : null;
}

const NoDetail = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: ${space(1)};
  border: 2px dashed ${p => p.theme.border};
  height: 100%;
`;
