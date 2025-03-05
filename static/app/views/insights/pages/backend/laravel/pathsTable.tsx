import {Fragment, useMemo} from 'react';
import {Link} from 'react-router-dom';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconUser} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

interface DiscoverQueryResponse {
  data: Array<{
    'avg(transaction.duration)': number;
    'count()': number;
    'count_unique(user)': number;
    'failure_rate()': number;
    'http.method': string;
    'p95()': number;
    'project.id': string;
    transaction: string;
  }>;
}

interface RouteControllerMapping {
  'count(span.duration)': number;
  'span.description': string;
  transaction: string;
  'transaction.method': string;
}

const errorRateColorThreshold = {
  danger: 0.1,
  warning: 0.05,
} as const;

const getP95Threshold = (avg: number) => {
  return {
    danger: avg * 3,
    warning: avg * 2,
  };
};

const getCellColor = (value: number, thresholds: Record<string, number>) => {
  return Object.entries(thresholds).find(([_, threshold]) => value >= threshold)?.[0];
};

export function PathsTable({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();
  const theme = useTheme();

  const transactionsRequest = useApiQuery<DiscoverQueryResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'metrics',
          field: [
            'http.method',
            'project.id',
            'transaction',
            'avg(transaction.duration)',
            'p95()',
            'failure_rate()',
            'count()',
            'count_unique(user)',
          ],
          query: `(transaction.op:http.server) event.type:transaction ${query}`,
          referrer: 'api.performance.landing-table',
          orderby: '-count()',
          per_page: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  // Get the list of transactions from the first request
  const transactionPaths = useMemo(() => {
    return (
      transactionsRequest.data?.data.map(transactions => transactions.transaction) ?? []
    );
  }, [transactionsRequest.data]);

  const routeControllersRequest = useApiQuery<{data: RouteControllerMapping[]}>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: [
            'span.description',
            'transaction',
            'transaction.method',
            'count(span.duration)',
          ],
          // Add transaction filter to route controller request
          query: `transaction.op:http.server span.op:http.route transaction:[${
            transactionPaths.map(transactions => `"${transactions}"`).join(',') || '""'
          }]`,
          sort: '-transaction',
          per_page: 25,
        },
      },
    ],
    {
      staleTime: 0,
      // Only fetch after we have the transactions data and there are transactions to look up
      enabled: !!transactionsRequest.data?.data && transactionPaths.length > 0,
    }
  );

  const tableData = useMemo(() => {
    if (!transactionsRequest.data?.data) {
      return [];
    }

    // Create a mapping of transaction path to controller
    const controllerMap = new Map(
      routeControllersRequest.data?.data.map(item => [
        item.transaction,
        item['span.description'],
      ])
    );

    return transactionsRequest.data.data.map(transaction => ({
      method: transaction['http.method'],
      transaction: transaction.transaction,
      requests: transaction['count()'],
      avg: transaction['avg(transaction.duration)'],
      p95: transaction['p95()'],
      errorRate: transaction['failure_rate()'],
      users: transaction['count_unique(user)'],
      controller: controllerMap.get(transaction.transaction),
      projectId: transaction['project.id'],
    }));
  }, [transactionsRequest.data, routeControllersRequest.data]);

  return (
    <StyledPanelTable
      headers={[
        'Method',
        'Path',
        <HeaderCell key="requests">
          <IconArrow direction="down" />
          Requests
        </HeaderCell>,
        'Error Rate',
        'AVG',
        'P95',
        <HeaderCell key="users" data-align="right">
          Users
        </HeaderCell>,
      ]}
      isLoading={transactionsRequest.isLoading}
      isEmpty={!tableData || tableData.length === 0}
    >
      {tableData?.map(transaction => {
        const p95Color = getCellColor(transaction.p95, getP95Threshold(transaction.avg));
        const errorRateColor = getCellColor(
          transaction.errorRate,
          errorRateColorThreshold
        );

        return (
          <Fragment key={transaction.method + transaction.transaction}>
            <Cell>{transaction.method}</Cell>
            <PathCell>
              <Tooltip
                title={transaction.transaction}
                position="top"
                maxWidth={400}
                showOnlyOnOverflow
                skipWrapper
              >
                <Link
                  css={css`
                    ${theme.overflowEllipsis};
                    min-width: 0px;
                  `}
                  to={transactionSummaryRouteWithQuery({
                    organization,
                    transaction: transaction.transaction,
                    view: 'backend',
                    projectID: transaction.projectId,
                    query: {},
                  })}
                >
                  {transaction.transaction}
                </Link>
              </Tooltip>
              {routeControllersRequest.isLoading ? (
                <Placeholder height={theme.fontSizeSmall} width="200px" />
              ) : (
                transaction.controller && (
                  <Tooltip
                    title={transaction.controller}
                    position="top"
                    maxWidth={400}
                    showOnlyOnOverflow
                    skipWrapper
                  >
                    <ControllerText>{transaction.controller}</ControllerText>
                  </Tooltip>
                )
              )}
            </PathCell>
            <Cell>{formatAbbreviatedNumber(transaction.requests)}</Cell>
            <Cell data-color={errorRateColor}>
              {(transaction.errorRate * 100).toFixed(2)}%
            </Cell>
            <Cell>{getDuration(transaction.avg / 1000, 2, true, true)}</Cell>
            <Cell data-color={p95Color}>
              {getDuration(transaction.p95 / 1000, 2, true, true)}
            </Cell>
            <Cell data-align="right">
              {formatAbbreviatedNumber(transaction.users)}
              <IconUser size="xs" />
            </Cell>
          </Fragment>
        );
      })}
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: max-content minmax(200px, 1fr) repeat(5, max-content);
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  overflow: hidden;
  white-space: nowrap;
  padding: ${space(1)} ${space(2)};

  &[data-color='danger'] {
    color: ${p => p.theme.red400};
  }
  &[data-color='warning'] {
    color: ${p => p.theme.yellow400};
  }
  &[data-align='right'] {
    text-align: right;
    justify-content: flex-end;
  }
`;

const HeaderCell = styled(Cell)`
  padding: 0;
`;

const PathCell = styled(Cell)`
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: ${space(0.5)};
  min-width: 0px;
`;

const ControllerText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
  min-width: 0px;
`;
