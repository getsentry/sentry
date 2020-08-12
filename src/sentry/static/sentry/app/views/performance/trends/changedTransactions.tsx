import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import {Panel} from 'app/components/panels';
import withOrganization from 'app/utils/withOrganization';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {Organization} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import space from 'app/styles/space';
import {RadioLineItem} from 'app/views/settings/components/forms/controls/radioGroup';
import Link from 'app/components/links/link';
import Radio from 'app/components/radio';
import Tooltip from 'app/components/tooltip';
import Count from 'app/components/count';

import Chart from './chart';
import {
  TrendChangeType,
  TrendView,
  TrendsData,
  NormalizedTrendsTransaction,
} from './types';
import {
  trendToColor,
  transformDurationDelta,
  transformPercentage,
  transformDeltaSpread,
  modifyTrendView,
  normalizeTrendsTransactions,
  getSelectedQueryKey,
} from './utils';
import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';

type Props = {
  organization: Organization;
  trendChangeType: TrendChangeType;
  trendView: TrendView;
  location: Location;
};

function getSelectedTransaction(
  location: Location,
  trendChangeType: TrendChangeType,
  transactions?: NormalizedTrendsTransaction[]
): string | undefined {
  const queryKey = getSelectedQueryKey(trendChangeType);
  const offsetString = decodeScalar(location.query[queryKey]);
  const offset = offsetString ? parseInt(offsetString, 10) : 0;
  if (!transactions || !transactions.length || offset >= transactions.length) {
    return undefined;
  }

  const transaction = transactions[offset].transaction;
  return transaction;
}

function handleChangeSelected(
  location: Location,
  trendChangeType: TrendChangeType,
  transactions?: NormalizedTrendsTransaction[]
) {
  return function updateSelected(transaction?: NormalizedTrendsTransaction) {
    const queryKey = getSelectedQueryKey(trendChangeType);
    const offset = transaction ? transactions?.indexOf(transaction) : -1;
    const query = {
      ...location.query,
    };
    if (!offset || offset < 0) {
      delete query[queryKey];
    } else {
      query[queryKey] = String(offset);
    }
    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };
}

function ChangedTransactions(props: Props) {
  const {location, trendChangeType, organization} = props;
  const trendView = props.trendView.clone();
  modifyTrendView(trendView, location, trendChangeType);

  return (
    <StyledPanel>
      <DiscoverQuery
        eventView={trendView}
        orgSlug={organization.slug}
        location={location}
        trendChangeType={trendChangeType}
      >
        {({isLoading, tableData}) => {
          const eventsTrendsData = (tableData as unknown) as TrendsData;
          const events = normalizeTrendsTransactions(
            (eventsTrendsData &&
              eventsTrendsData.events &&
              eventsTrendsData.events.data) ||
              []
          );
          const selectedTransaction = getSelectedTransaction(
            location,
            trendChangeType,
            events
          );

          const results = eventsTrendsData && eventsTrendsData.stats;
          const transactionsList = events && events.slice ? events.slice(0, 5) : [];

          return (
            <React.Fragment>
              <ChartContainer>
                <Chart
                  statsData={results}
                  query={trendView.query}
                  project={trendView.project}
                  environment={trendView.environment}
                  start={trendView.start}
                  end={trendView.end}
                  statsPeriod={trendView.statsPeriod}
                  transaction={selectedTransaction}
                  isLoading={isLoading}
                  {...props}
                />
              </ChartContainer>
              <TransactionsList>
                {transactionsList.map((transaction, index) => (
                  <TrendsListItem
                    trendView={trendView}
                    organization={organization}
                    transaction={transaction}
                    key={index}
                    index={index}
                    trendChangeType={trendChangeType}
                    transactions={transactionsList}
                    location={location}
                    handleSelectTransaction={handleChangeSelected(
                      location,
                      trendChangeType,
                      transactionsList
                    )}
                  />
                ))}
              </TransactionsList>
            </React.Fragment>
          );
        }}
      </DiscoverQuery>
    </StyledPanel>
  );
}

type TrendsListItemProps = {
  trendView: TrendView;
  organization: Organization;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  transactions: NormalizedTrendsTransaction[];
  location: Location;
  index: number;
  handleSelectTransaction: (transaction: NormalizedTrendsTransaction) => void;
};

function TrendsListItem(props: TrendsListItemProps) {
  const {
    transaction,
    transactions,
    trendChangeType,
    index,
    location,
    handleSelectTransaction,
  } = props;
  const color = trendToColor[trendChangeType];

  const selectedTransaction = getSelectedTransaction(
    location,
    trendChangeType,
    transactions
  );
  const isSelected = selectedTransaction === transaction.transaction;

  return (
    <ListItemContainer>
      <ItemRadioContainer color={color}>
        <RadioLineItem index={index} role="radio">
          <Radio
            checked={isSelected}
            onChange={() => handleSelectTransaction(transaction)}
          />
        </RadioLineItem>
      </ItemRadioContainer>
      <ItemTransactionNameContainer>
        <ItemTransactionName>
          <TransactionLink {...props} />
        </ItemTransactionName>
        <ItemTransactionAbsoluteFaster>
          {transformDeltaSpread(
            transaction.aggregate_range_1,
            transaction.aggregate_range_2
          )}
        </ItemTransactionAbsoluteFaster>
      </ItemTransactionNameContainer>
      <ItemTransactionPercentContainer>
        <Tooltip
          title={
            <TooltipContent>
              <span>{transaction.project}</span>
              <span>
                <Count value={transaction.count_range_1} />
                {' → '}
                <Count value={transaction.count_range_2} />
              </span>
            </TooltipContent>
          }
        >
          <ItemTransactionPercent>
            {transformPercentage(transaction.divide_aggregate_range_2_aggregate_range_1)}
          </ItemTransactionPercent>
        </Tooltip>
        <ItemTransactionPercentFaster color={color}>
          {transformDurationDelta(
            transaction.minus_aggregate_range_2_aggregate_range_1,
            trendChangeType
          )}
        </ItemTransactionPercentFaster>
      </ItemTransactionPercentContainer>
    </ListItemContainer>
  );
}

type TransactionLinkProps = TrendsListItemProps & {};

const TransactionLink = (props: TransactionLinkProps) => {
  const {organization, trendView: eventView, transaction} = props;

  const summaryView = eventView.clone();
  const target = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction: String(transaction.transaction) || '',
    query: summaryView.generateQueryStringObject(),
  });

  return <StyledLink to={target}>{transaction.transaction}</StyledLink>;
};

const StyledLink = styled(Link)`
  word-break: break-all;
`;

const TransactionsList = styled('div')``;
const ListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.borderLight};
  padding: ${space(1)} ${space(2)};
`;

const ItemRadioContainer = styled('div')`
  input:checked::after {
    background-color: ${p => p.color};
    width: 14px;
    height: 14px;
  }
`;
const ItemTransactionNameContainer = styled('div')`
  flex-grow: 1;
`;
const ItemTransactionName = styled('div')``;
const ItemTransactionAbsoluteFaster = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: 14px;
`;
const ItemTransactionPercent = styled('div')``;
const ItemTransactionPercentFaster = styled('div')`
  color: ${p => p.color};
  font-size: 14px;
  white-space: nowrap;
`;
const ItemTransactionPercentContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const TooltipContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ChartContainer = styled('div')`
  padding: ${space(2)};
`;

const StyledPanel = styled(Panel)``;

export default withOrganization(ChangedTransactions);
