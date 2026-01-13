import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {Actions} from 'sentry/views/discover/table/cellAction';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

interface TransactionCellProps {
  column: GridColumnOrder<string>;
  dataRow: Record<string, any>;
  projectId: string;
  targetView: 'backend' | 'frontend';
  transaction: string;
  details?: React.ReactNode;
  query?: string;
}

export function TransactionCell({
  transaction,
  projectId,
  column,
  dataRow,
  details,
  targetView,
  query,
}: TransactionCellProps) {
  const organization = useOrganization();
  const {setTransactionFilter} = useTransactionNameQuery();

  const transactionSummaryLink = transactionSummaryRouteWithQuery({
    organization,
    transaction,
    view: targetView,
    projectID: projectId,
    query: {
      query: query || '',
    },
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
      allowActions={[Actions.ADD, Actions.OPEN_INTERNAL_LINK]}
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
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0px;
`;
