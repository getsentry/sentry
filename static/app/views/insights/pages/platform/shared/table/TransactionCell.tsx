import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {Actions} from 'sentry/views/discover/table/cellAction';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

export function TransactionCell({
  transaction,
  projectId,
  column,
  dataRow,
  details,
  targetView,
}: {
  column: GridColumnOrder<string>;
  dataRow: Record<string, any>;
  projectId: string;
  targetView: 'backend' | 'frontend';
  transaction: string;
  details?: React.ReactNode;
}) {
  const organization = useOrganization();
  const {setTransactionFilter} = useTransactionNameQuery();

  const transactionSummaryLink = transactionSummaryRouteWithQuery({
    organization,
    transaction,
    view: targetView,
    projectID: projectId,
    query: {},
  });

  return (
    <CellAction
      column={{
        ...column,
        isSortable: true,
        type: 'string',
        column: {kind: 'field', field: 'transaction'},
      }}
      dataRow={dataRow as any}
      allowActions={[Actions.ADD]}
      handleCellAction={() => setTransactionFilter(transaction)}
    >
      <CellWrapper>
        <Tooltip
          title={transaction}
          position="top"
          maxWidth={400}
          showOnlyOnOverflow
          skipWrapper
        >
          <TransactionLink to={transactionSummaryLink}>{transaction}</TransactionLink>
        </Tooltip>
        {details}
      </CellWrapper>
    </CellAction>
  );
}

const CellWrapper = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: ${space(0.5)};
  min-width: 0px;
`;

const TransactionLink = styled(Link)`
  ${p => p.theme.overflowEllipsis};
  min-width: 0px;
`;
