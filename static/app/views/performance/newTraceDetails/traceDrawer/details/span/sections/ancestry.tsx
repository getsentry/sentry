import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {LinkButton} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DiscoverButton from 'sentry/components/discoverButton';
import * as SpanEntryContext from 'sentry/components/events/interfaces/spans/context';
import {
  getTraceDateTimeRange,
  isGapSpan,
  scrollToSpan,
} from 'sentry/components/events/interfaces/spans/utils';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS, PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {assert} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

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
          orgSlug: organization.slug,
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
      <StyledDiscoverButton href="#" size="xs" disabled>
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
      to={childrenEventView.getResultsViewUrlTarget(
        organization.slug,
        false,
        hasDatasetSelector(organization) ? SavedQueryDatasets.TRANSACTIONS : undefined
      )}
    >
      {t('View Children')}
    </StyledDiscoverButton>
  );
}

export function getSpanAncestryAndGroupingItems({
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
  const parentTransaction = node.parent_transaction;
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
    key: 'span_id',
    value: (
      <Fragment>
        {span.span_id}
        <CopyToClipboardButton borderless size="zero" iconSize="xs" text={span.span_id} />
      </Fragment>
    ),
    subject: 'Span ID',
    subjectNode: (
      <TraceDrawerComponents.FlexBox style={{gap: '5px'}}>
        <span onClick={scrollToSpan(span.span_id, () => {}, location, organization)}>
          Span ID
        </span>
        <SpanChildrenTraversalButton node={node} organization={organization} />
      </TraceDrawerComponents.FlexBox>
    ),
  });

  items.push({
    key: 'origin',
    value: span.origin !== undefined ? String(span.origin) : null,
    subject: t('Origin'),
  });

  items.push({
    key: 'parent_span_id',
    value: span.parent_span_id || '',
    subject: t('Parent Span ID'),
  });

  const childTransaction = node.value.childTransactions?.[0];

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

  items.push({
    key: 'same_group',
    value: defined(span.hash) ? String(span.hash) : null,
    subject: t('Span Group'),
  });

  return items;
}

const StyledDiscoverButton = styled(DiscoverButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: flex;
  align-items: center;
  height: ${space(2)};
  margin: 0;
`;

const SpanChildValueWrapper = styled(TraceDrawerComponents.FlexBox)`
  justify-content: space-between;
  gap: ${space(0.5)};
`;
