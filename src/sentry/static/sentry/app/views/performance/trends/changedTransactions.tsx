import React from 'react';
import {Location, Query} from 'history';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import {Panel} from 'app/components/panels';
import Pagination from 'app/components/pagination';
import withOrganization from 'app/utils/withOrganization';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {Organization, Project, AvatarProject} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import space from 'app/styles/space';
import {RadioLineItem} from 'app/views/settings/components/forms/controls/radioGroup';
import Link from 'app/components/links/link';
import Radio from 'app/components/radio';
import Tooltip from 'app/components/tooltip';
import Count from 'app/components/count';
import {formatPercentage, getDuration} from 'app/utils/formatters';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
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
  normalizeTrendsTransactions,
  getSelectedQueryKey,
  getCurrentTrendFunction,
  getTrendBaselinesForTransaction,
  getIntervalRatio,
  StyledIconArrow,
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

function getTransactionProjectId(
  transaction: NormalizedTrendsTransaction,
  projects?: Project[]
): string | undefined {
  if (!transaction.project || !projects) {
    return undefined;
  }
  const transactionProject = projects.find(
    project => project.slug === transaction.project
  );
  return transactionProject?.id;
}

function getChartTitle(trendChangeType: TrendChangeType): string {
  switch (trendChangeType) {
    case TrendChangeType.IMPROVED:
      return t('Most Improved');
    case TrendChangeType.REGRESSION:
      return t('Worst Regressions');
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
        const events = normalizeTrendsTransactions(
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
          <ChangedTransactionsContainer>
            <StyledPanel>
              <ContainerTitle>
                <HeaderTitleLegend>
                  {chartTitle}{' '}
                  <QuestionTooltip size="sm" position="top" title={titleTooltipContent} />
                </HeaderTitleLegend>
              </ContainerTitle>
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
                  <TransactionsList>
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
                  </TransactionsList>
                </React.Fragment>
              ) : (
                <EmptyStateContainer>
                  <EmptyStateWarning small>{t('No results')}</EmptyStateWarning>
                </EmptyStateContainer>
              )}
            </StyledPanel>
            <Pagination pageLinks={pageLinks} onCursor={onCursor} />
          </ChangedTransactionsContainer>
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
            <TransactionLink {...props} />
          </Tooltip>
          <TransactionMenuContainer>
            <DropdownLink
              caret={false}
              title={
                <TransactionMenuButton>
                  <IconEllipsis data-test-id="trends-item-action" color="gray600" />
                </TransactionMenuButton>
              }
            >
              <MenuItem>
                <TransactionSummaryLink {...props} />
              </MenuItem>
            </DropdownLink>
          </TransactionMenuContainer>
        </ItemTransactionName>
        <ItemTransactionNameSecondary>
          {project && (
            <Tooltip title={transaction.project}>
              <StyledProjectAvatar project={project} />
            </Tooltip>
          )}
          <ItemTransactionAbsoluteFaster>
            {transformDeltaSpread(
              transaction.aggregate_range_1,
              transaction.aggregate_range_2,
              currentTrendFunction
            )}
          </ItemTransactionAbsoluteFaster>
        </ItemTransactionNameSecondary>
      </ItemTransactionNameContainer>
      <ItemTransactionPercentContainer>
        <ItemTransactionPrimary>
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
        </ItemTransactionPrimary>
        <ItemTransactionSecondary color={color}>
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
        </ItemTransactionSecondary>
      </ItemTransactionPercentContainer>
    </ListItemContainer>
  );
}

type TransactionLinkProps = TrendsListItemProps & {};

const TransactionLink = (props: TransactionLinkProps) => {
  const {
    organization,
    trendView: eventView,
    transaction,
    api,
    statsData,
    location,
  } = props;
  const summaryView = eventView.clone();
  const intervalRatio = getIntervalRatio(location);

  async function onLinkClick() {
    const baselines = await getTrendBaselinesForTransaction(
      api,
      organization,
      eventView,
      statsData,
      intervalRatio,
      transaction
    );
    if (baselines) {
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

  return <StyledLink onClick={onLinkClick}>{transaction.transaction}</StyledLink>;
};

type TransactionSummaryLinkProps = TrendsListItemProps & {};

const TransactionSummaryLink = (props: TransactionSummaryLinkProps) => {
  const {organization, trendView: eventView, transaction, projects} = props;

  const summaryView = eventView.clone();
  const projectID = getTransactionProjectId(transaction, projects);
  const target = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction: String(transaction.transaction),
    query: summaryView.generateQueryStringObject(),
    projectID,
  });

  return <StyledSummaryLink to={target}>{t('View Summary')}</StyledSummaryLink>;
};

const ChangedTransactionsContainer = styled('div')``;
const StyledLink = styled('a')`
  word-break: break-all;
`;

const StyledSummaryLink = styled(Link)`
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const TransactionMenuButton = styled('button')`
  display: flex;
  height: 100%;
  justify-content: center;
  align-items: center;
  padding: 0 ${space(1)};

  border: 0;
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  outline: none;
`;
const TransactionMenuContainer = styled('div')`
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const TransactionsList = styled('div')``;

const ListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.borderLight};
  padding: ${space(1)} ${space(2)};
`;

const ItemRadioContainer = styled('div')`
  input {
    cursor: pointer;
  }
  input:checked::after {
    background-color: ${p => p.color};
  }
`;
const ItemTransactionNameContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  flex-grow: 1;
`;
const ItemTransactionName = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
`;
const ItemTransactionNameSecondary = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const ItemTransactionAbsoluteFaster = styled('div')`
  color: ${p => p.theme.gray500};
  margin-left: ${space(1)};
`;
const ItemTransactionPrimary = styled('div')``;
const ItemTransactionSecondary = styled('div')`
  color: ${p => p.color};
  white-space: nowrap;
`;
const ItemTransactionPercentContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TooltipContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ContainerTitle = styled('div')`
  padding-top: ${space(3)};
  padding-left: ${space(2)};
`;

const ChartContainer = styled('div')`
  padding: ${space(2)};
  padding-top: 0;
`;
const EmptyStateContainer = styled('div')`
  padding: ${space(4)} 0;
`;

const StyledProjectAvatar = styled(ProjectAvatar)``;

const StyledPanel = styled(Panel)``;

export default withApi(withProjects(withOrganization(ChangedTransactions)));
