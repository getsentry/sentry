import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DiscoverButton from 'sentry/components/discoverButton';
import * as SpanEntryContext from 'sentry/components/events/interfaces/spans/context';
import {
  getTraceDateTimeRange,
  isGapSpan,
  scrollToSpan,
} from 'sentry/components/events/interfaces/spans/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS, PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {assert} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {TraceDrawerComponents} from '../../../../styles';
import {ButtonGroup} from '..';

type TransactionResult = {
  id: string;
  'project.name': string;
  'trace.span': string;
  transaction: string;
};

function SpanChild({
  node,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  const childTransaction = node.value.childTransactions?.[0];

  if (!childTransaction) {
    return null;
  }

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

  const viewChildButton = (
    <SpanEntryContext.Consumer>
      {({getViewChildTransactionTarget}) => {
        const to = getViewChildTransactionTarget({
          ...transactionResult,
          eventSlug,
        });

        if (!to) {
          return null;
        }

        const target = transactionSummaryRouteWithQuery({
          orgSlug: organization.slug,
          transaction: transactionResult.transaction,
          query: omit(location.query, Object.values(PAGE_URL_PARAM)),
          projectID: String(childTransaction.value.project_id),
        });

        return (
          <ButtonGroup>
            <Button data-test-id="view-child-transaction" size="xs" to={to}>
              {t('View Transaction')}
            </Button>
            <Button size="xs" to={target}>
              {t('View Summary')}
            </Button>
          </ButtonGroup>
        );
      }}
    </SpanEntryContext.Consumer>
  );

  return (
    <TraceDrawerComponents.TableRow
      title={t('Child Transaction')}
      extra={viewChildButton}
    >
      {`${transactionResult.transaction} (${transactionResult['project.name']})`}
    </TraceDrawerComponents.TableRow>
  );
}

function SpanChildrenTraversalButton({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  if (!node.value.childTransactions) {
    // TODO: Amend size to use theme when we eventually refactor LoadingIndicator
    // 12px is consistent with theme.iconSizes['xs'] but theme returns a string.
    return (
      <StyledDiscoverButton size="xs" disabled>
        <StyledLoadingIndicator size={12} />
      </StyledDiscoverButton>
    );
  }

  if (node.value.childTransactions.length <= 0) {
    return null;
  }

  assert(!isGapSpan(node.value));

  if (node.value.childTransactions.length === 1) {
    // Note: This is rendered by renderSpanChild() as a dedicated row
    return null;
  }

  const {start, end} = getTraceDateTimeRange({
    start: node.value.event.startTimestamp,
    end: node.value.event.endTimestamp,
  });

  const childrenEventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Children from Span ID ${node.value.span_id}`,
    fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
    orderby: '-timestamp',
    query: `event.type:transaction trace:${node.value.trace_id} trace.parent_span:${node.value.span_id}`,
    projects: organization.features.includes('global-views')
      ? [ALL_ACCESS_PROJECTS]
      : [Number(node.value.event.projectID)],
    version: 2,
    start,
    end,
  });

  return (
    <StyledDiscoverButton
      data-test-id="view-child-transactions"
      size="xs"
      to={childrenEventView.getResultsViewUrlTarget(organization.slug)}
    >
      {t('View Children')}
    </StyledDiscoverButton>
  );
}

export function AncestryAndGrouping({
  node,
  onParentClick,
  location,
  organization,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
}) {
  const parentTransaction = node.parent_transaction;
  const span = node.value;
  return (
    <Fragment>
      {parentTransaction ? (
        <TraceDrawerComponents.TableRow title="Parent Transaction">
          <td className="value">
            <a href="#" onClick={() => onParentClick(parentTransaction)}>
              {getTraceTabTitle(parentTransaction)}
            </a>
          </td>
        </TraceDrawerComponents.TableRow>
      ) : null}

      <TraceDrawerComponents.TableRow
        title={
          isGapSpan(span) ? (
            <SpanIdTitle>Span ID</SpanIdTitle>
          ) : (
            <SpanIdTitle
              onClick={scrollToSpan(span.span_id, () => {}, location, organization)}
            >
              Span ID
            </SpanIdTitle>
          )
        }
        extra={<SpanChildrenTraversalButton node={node} organization={organization} />}
      >
        {span.span_id}
        <CopyToClipboardButton borderless size="zero" iconSize="xs" text={span.span_id} />
      </TraceDrawerComponents.TableRow>
      <TraceDrawerComponents.TableRow title={t('Origin')}>
        {span.origin !== undefined ? String(span.origin) : null}
      </TraceDrawerComponents.TableRow>

      <TraceDrawerComponents.TableRow title="Parent Span ID">
        {span.parent_span_id || ''}
      </TraceDrawerComponents.TableRow>
      <SpanChild node={node} organization={organization} location={location} />
      <TraceDrawerComponents.TableRow title={t('Same Process as Parent')}>
        {span.same_process_as_parent !== undefined
          ? String(span.same_process_as_parent)
          : null}
      </TraceDrawerComponents.TableRow>
      <TraceDrawerComponents.TableRow title={t('Span Group')}>
        {defined(span.hash) ? String(span.hash) : null}
      </TraceDrawerComponents.TableRow>
    </Fragment>
  );
}

const StyledDiscoverButton = styled(DiscoverButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const SpanIdTitle = styled('a')`
  display: flex;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: flex;
  align-items: center;
  height: ${space(2)};
  margin: 0;
`;
