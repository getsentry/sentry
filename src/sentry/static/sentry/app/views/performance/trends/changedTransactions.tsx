import React from 'react';
import {Location, Query} from 'history';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import {Panel} from 'app/components/panels';
import Pagination from 'app/components/pagination';
import LoadingIndicator from 'app/components/loadingIndicator';
import withOrganization from 'app/utils/withOrganization';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {Organization, Project, AvatarProject} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import space from 'app/styles/space';
import {RadioLineItem} from 'app/views/settings/components/forms/controls/radioGroup';
import Link from 'app/components/links/link';
import Button from 'app/components/button';
import Radio from 'app/components/radio';
import Tooltip from 'app/components/tooltip';
import Count from 'app/components/count';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {formatPercentage, getDuration} from 'app/utils/formatters';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withProjects from 'app/utils/withProjects';
import {IconEllipsis} from 'app/icons';
import MenuItem from 'app/components/menuItem';
import DropdownLink from 'app/components/dropdownLink';
import ProjectAvatar from 'app/components/avatar/projectAvatar';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import QuestionTooltip from 'app/components/questionTooltip';

import Chart from './chart';
import {
  TrendChangeType,
  TrendView,
  TrendsData,
  NormalizedTrendsTransaction,
  TrendFunctionField,
  TrendsStats,
} from './types';
import {
  trendToColor,
  transformValueDelta,
  transformDeltaSpread,
  modifyTrendView,
  normalizeTrends,
  getSelectedQueryKey,
  getCurrentTrendFunction,
  getTrendBaselinesForTransaction,
  getIntervalRatio,
  StyledIconArrow,
  getTrendProjectId,
} from './utils';
import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';
import {HeaderTitleLegend} from '../styles';

type Props = {
  api: Client;
  organization: Organization;
  trendChangeType: TrendChangeType;
  previousTrendFunction?: TrendFunctionField;
  trendView: TrendView;
  location: Location;
  projects: Project[];
};

type TrendsCursorQuery = {
  improvedCursor?: string;
  regressionCursor?: string;
};

function onTrendsCursor(trendChangeType: TrendChangeType) {
  return function onCursor(
    cursor: string,
    path: string,
    query: Query,
    _direction: number
  ) {
    const cursorQuery = {} as TrendsCursorQuery;
    if (trendChangeType === TrendChangeType.IMPROVED) {
      cursorQuery.improvedCursor = cursor;
    } else if (trendChangeType === TrendChangeType.REGRESSION) {
      cursorQuery.regressionCursor = cursor;
    }
    browserHistory.push({
      pathname: path,
      query: {...query, ...cursorQuery},
    });
  };
}

function getChartTitle(trendChangeType: TrendChangeType): string {
  switch (trendChangeType) {
    case TrendChangeType.IMPROVED:
      return t('Most Improved Transactions');
    case TrendChangeType.REGRESSION:
      return t('Most Regressed Transactions');
    default:
      throw new Error('No trend type passed');
  }
}

function getSelectedTransaction(
  location: Location,
  trendChangeType: TrendChangeType,
  transactions?: NormalizedTrendsTransaction[]
): NormalizedTrendsTransaction | undefined {
  const queryKey = getSelectedQueryKey(trendChangeType);
  const offsetString = decodeScalar(location.query[queryKey]);
  const offset = offsetString ? parseInt(offsetString, 10) : 0;
  if (!transactions || !transactions.length || offset >= transactions.length) {
    return undefined;
  }

  const transaction = transactions[offset];
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
  const {
    api,
    location,
    trendChangeType,
    previousTrendFunction,
    organization,
    projects,
  } = props;
  const trendView = props.trendView.clone();
  const chartTitle = getChartTitle(trendChangeType);
  modifyTrendView(trendView, location, trendChangeType);

  const onCursor = onTrendsCursor(trendChangeType);

  return (
    <DiscoverQuery
      eventView={trendView}
      orgSlug={organization.slug}
      location={location}
      trendChangeType={trendChangeType}
      limit={5}
    >
      {({isLoading, tableData, pageLinks}) => {
        const eventsTrendsData = (tableData as unknown) as TrendsData;
        const events = normalizeTrends(
          (eventsTrendsData && eventsTrendsData.events && eventsTrendsData.events.data) ||
            []
        );
        const selectedTransaction = getSelectedTransaction(
          location,
          trendChangeType,
          events
        );

        const statsData = eventsTrendsData && eventsTrendsData.stats;
        const transactionsList = events && events.slice ? events.slice(0, 5) : [];

        const trendFunction = getCurrentTrendFunction(location);
        const currentTrendFunction =
          isLoading && previousTrendFunction
            ? previousTrendFunction
            : trendFunction.field;

        const titleTooltipContent = t(
          'This compares the baseline (%s) of the past with the present.',
          trendFunction.legendLabel
        );

        return (
          <TransactionsListContainer>
            <TrendsTransactionPanel>
              <StyledHeaderTitleLegend>
                {chartTitle}{' '}
                <QuestionTooltip size="sm" position="top" title={titleTooltipContent} />
              </StyledHeaderTitleLegend>
              {isLoading ? (
                <LoadingIndicator
                  style={{
                    margin: '237px auto',
                  }}
                />
              ) : (
                <React.Fragment>
                  {transactionsList.length ? (
                    <React.Fragment>
                      <ChartContainer>
                        <Chart
                          statsData={statsData}
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
                      {transactionsList.map((transaction, index) => (
                        <TrendsListItem
                          api={api}
                          currentTrendFunction={currentTrendFunction}
                          trendView={props.trendView}
                          organization={organization}
                          transaction={transaction}
                          key={transaction.transaction}
                          index={index}
                          trendChangeType={trendChangeType}
                          transactions={transactionsList}
                          location={location}
                          projects={projects}
                          statsData={statsData}
                          handleSelectTransaction={handleChangeSelected(
                            location,
                            trendChangeType,
                            transactionsList
                          )}
                        />
                      ))}
                    </React.Fragment>
                  ) : (
                    <StyledEmptyStateWarning small>
                      {t('No results')}
                    </StyledEmptyStateWarning>
                  )}
                </React.Fragment>
              )}
            </TrendsTransactionPanel>
            <Pagination pageLinks={pageLinks} onCursor={onCursor} />
          </TransactionsListContainer>
        );
      }}
    </DiscoverQuery>
  );
}

type TrendsListItemProps = {
  api: Client;
  trendView: TrendView;
  organization: Organization;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  currentTrendFunction: TrendFunctionField;
  transactions: NormalizedTrendsTransaction[];
  projects: Project[];
  location: Location;
  index: number;
  statsData: TrendsStats;
  handleSelectTransaction: (transaction: NormalizedTrendsTransaction) => void;
};

function TrendsListItem(props: TrendsListItemProps) {
  const {
    transaction,
    transactions,
    trendChangeType,
    currentTrendFunction,
    index,
    location,
    projects,
    handleSelectTransaction,
  } = props;
  const color = trendToColor[trendChangeType];

  const selectedTransaction = getSelectedTransaction(
    location,
    trendChangeType,
    transactions
  );
  const isSelected = selectedTransaction === transaction;

  const project = projects.find(
    ({slug}) => slug === transaction.project
  ) as AvatarProject;

  const currentPeriodValue = transaction.aggregate_range_2;
  const previousPeriodValue = transaction.aggregate_range_1;

  const percentChange = formatPercentage(
    transaction.percentage_aggregate_range_2_aggregate_range_1 - 1,
    0
  );

  const absolutePercentChange = formatPercentage(
    Math.abs(transaction.percentage_aggregate_range_2_aggregate_range_1 - 1),
    0
  );

  const percentChangeExplanation = t(
    'Over this period, the duration for %s has %s %s from %s to %s',
    currentTrendFunction,
    trendChangeType === TrendChangeType.IMPROVED ? t('decreased') : t('increased'),
    absolutePercentChange,
    getDuration(previousPeriodValue / 1000, previousPeriodValue < 1000 ? 0 : 2),
    getDuration(currentPeriodValue / 1000, currentPeriodValue < 1000 ? 0 : 2)
  );

  return (
    <ListItemContainer data-test-id={'trends-list-item-' + trendChangeType}>
      <ItemRadioContainer color={color}>
        <RadioLineItem index={index} role="radio">
          <Radio
            checked={isSelected}
            onChange={() => handleSelectTransaction(transaction)}
          />
        </RadioLineItem>
      </ItemRadioContainer>
      <ItemTransactionName>
        <Tooltip
          title={
            <TooltipContent>
              <span>{t('Total Events')}</span>
              <span>
                <Count value={transaction.count_range_1} />
                <StyledIconArrow direction="right" size="xs" />
                <Count value={transaction.count_range_2} />
              </span>
            </TooltipContent>
          }
        >
          <TransactionName onClick={() => handleSelectTransaction(transaction)}>
            {transaction.transaction}
          </TransactionName>
        </Tooltip>
        <DropdownLink
          caret={false}
          title={
            <StyledButton
              size="zero"
              borderless
              icon={<IconEllipsis data-test-id="trends-item-action" />}
            />
          }
        >
          <MenuItem>
            <TransactionSummaryLink {...props} />
          </MenuItem>
        </DropdownLink>
      </ItemTransactionName>
      <ItemTransactionPercentage>
        <Tooltip title={percentChangeExplanation}>
          {currentTrendFunction === TrendFunctionField.USER_MISERY ? (
            <React.Fragment>
              {transformValueDelta(
                transaction.minus_aggregate_range_2_aggregate_range_1,
                trendChangeType,
                currentTrendFunction
              )}
            </React.Fragment>
          ) : (
            <React.Fragment>
              {trendChangeType === TrendChangeType.REGRESSION ? '+' : ''}
              {formatPercentage(
                transaction.percentage_aggregate_range_2_aggregate_range_1 - 1,
                0
              )}
            </React.Fragment>
          )}
        </Tooltip>
      </ItemTransactionPercentage>
      <ItemTransactionDurationChange>
        {project && (
          <Tooltip title={transaction.project}>
            <ProjectAvatar project={project} />
          </Tooltip>
        )}

        <Tooltip title={t('Compare baselines')}>
          <CompareLink {...props} />
        </Tooltip>
      </ItemTransactionDurationChange>
      <ItemTransactionStatus color={color}>
        {currentTrendFunction === TrendFunctionField.USER_MISERY ? (
          <React.Fragment>
            {trendChangeType === TrendChangeType.REGRESSION ? '+' : ''}
            {percentChange}
          </React.Fragment>
        ) : (
          <React.Fragment>
            {transformValueDelta(
              transaction.minus_aggregate_range_2_aggregate_range_1,
              trendChangeType,
              currentTrendFunction
            )}
          </React.Fragment>
        )}
      </ItemTransactionStatus>
    </ListItemContainer>
  );
}

type CompareLinkProps = TrendsListItemProps & {};

const CompareLink = (props: CompareLinkProps) => {
  const {
    organization,
    trendView: eventView,
    transaction,
    api,
    location,
    currentTrendFunction,
  } = props;
  const summaryView = eventView.clone();
  const intervalRatio = getIntervalRatio(location);

  async function onLinkClick() {
    const baselines = await getTrendBaselinesForTransaction(
      api,
      organization,
      eventView,
      intervalRatio,
      transaction
    );
    if (baselines) {
      trackAnalyticsEvent({
        eventKey: 'performance_views.trends.compare_baselines',
        eventName: 'Performance Views: Comparing baselines',
        organization_id: parseInt(organization.id, 10),
      });

      const {previousPeriod, currentPeriod} = baselines;
      const comparisonString = `${previousPeriod.project}:${previousPeriod.id}/${currentPeriod.project}:${currentPeriod.id}`;
      browserHistory.push({
        pathname: `/organizations/${organization.slug}/performance/compare/${comparisonString}/`,
        query: {
          ...summaryView.generateQueryStringObject(),
          transaction: String(transaction.transaction),
        },
      });
    }
  }

  return (
    <DurationChange onClick={onLinkClick}>
      {transformDeltaSpread(
        transaction.aggregate_range_1,
        transaction.aggregate_range_2,
        currentTrendFunction
      )}
    </DurationChange>
  );
};

type TransactionSummaryLinkProps = TrendsListItemProps & {};

const TransactionSummaryLink = (props: TransactionSummaryLinkProps) => {
  const {organization, trendView: eventView, transaction, projects} = props;

  const summaryView = eventView.clone();
  const projectID = getTrendProjectId(transaction, projects);
  const target = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction: String(transaction.transaction),
    query: summaryView.generateQueryStringObject(),
    projectID,
  });

  return <StyledSummaryLink to={target}>{t('View Summary')}</StyledSummaryLink>;
};

const TransactionsListContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const TrendsTransactionPanel = styled(Panel)`
  margin: 0;
  flex-grow: 1;
`;

const ChartContainer = styled('div')`
  padding: ${space(3)};
`;

const StyledHeaderTitleLegend = styled(HeaderTitleLegend)`
  padding: 0;
  margin: ${space(3)};
`;

const StyledButton = styled(Button)`
  vertical-align: middle;
`;

const TransactionName = styled('div')`
  cursor: pointer;
  margin-right: ${space(1)};
  ${overflowEllipsis};
`;

const DurationChange = styled('a')`
  margin: 0 ${space(1)};
`;

const StyledSummaryLink = styled(Link)`
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  min-height: 300px;
  justify-content: center;
`;

const ListItemContainer = styled('div')`
  display: grid;
  grid-template-columns: 24px 75% auto;
  grid-template-rows: repeat(2, auto);
  grid-column-gap: ${space(1)};
  border-top: 1px solid ${p => p.theme.borderLight};
  padding: ${space(1)} ${space(2)};
`;

const ItemRadioContainer = styled('div')`
  grid-row: 1/3;
  input:checked::after {
    background-color: ${p => p.color};
  }
`;

const ItemTransactionName = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ItemTransactionDurationChange = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const ItemTransactionPercentage = styled('div')`
  text-align: right;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ItemTransactionStatus = styled('div')`
  color: ${p => p.color};
  text-align: right;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TooltipContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export default withApi(withProjects(withOrganization(ChangedTransactions)));
