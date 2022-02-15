import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import DropdownLink from 'sentry/components/dropdownLink';
import Duration from 'sentry/components/duration';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MenuItem from 'sentry/components/menuItem';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import Tooltip from 'sentry/components/tooltip';
import {IconArrow, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {AvatarProject, Organization, Project} from 'sentry/types';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import {DisplayModes} from '../transactionSummary/transactionOverview/charts';
import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';

import Chart from './chart';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendColumnField,
  TrendFunctionField,
  TrendsStats,
  TrendView,
} from './types';
import {
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getSelectedQueryKey,
  getTrendProjectId,
  modifyTrendView,
  normalizeTrends,
  transformDeltaSpread,
  transformValueDelta,
  trendCursorNames,
  trendToColor,
} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
  setError: (msg: string | undefined) => void;
  trendChangeType: TrendChangeType;
  trendView: TrendView;
  previousTrendColumn?: TrendColumnField;
  previousTrendFunction?: TrendFunctionField;
};

type TrendsCursorQuery = {
  improvedCursor?: string;
  regressionCursor?: string;
};

const makeTrendsCursorHandler =
  (trendChangeType: TrendChangeType): CursorHandler =>
  (cursor, path, query) => {
    const cursorQuery = {} as TrendsCursorQuery;
    if (trendChangeType === TrendChangeType.IMPROVED) {
      cursorQuery.improvedCursor = cursor;
    } else if (trendChangeType === TrendChangeType.REGRESSION) {
      cursorQuery.regressionCursor = cursor;
    }

    const selectedQueryKey = getSelectedQueryKey(trendChangeType);
    delete query[selectedQueryKey];

    browserHistory.push({
      pathname: path,
      query: {...query, ...cursorQuery},
    });
  };

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
  const selectedTransactionName = decodeScalar(location.query[queryKey]);

  if (!transactions) {
    return undefined;
  }

  const selectedTransaction = transactions.find(
    transaction =>
      `${transaction.transaction}-${transaction.project}` === selectedTransactionName
  );

  if (selectedTransaction) {
    return selectedTransaction;
  }

  return transactions.length > 0 ? transactions[0] : undefined;
}

function handleChangeSelected(location: Location, trendChangeType: TrendChangeType) {
  return function updateSelected(transaction?: NormalizedTrendsTransaction) {
    const selectedQueryKey = getSelectedQueryKey(trendChangeType);
    const query = {
      ...location.query,
    };
    if (!transaction) {
      delete query[selectedQueryKey];
    } else {
      query[selectedQueryKey] = transaction
        ? `${transaction.transaction}-${transaction.project}`
        : undefined;
    }
    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };
}

enum FilterSymbols {
  GREATER_THAN_EQUALS = '>=',
  LESS_THAN_EQUALS = '<=',
}

function handleFilterTransaction(location: Location, transaction: string) {
  const queryString = decodeScalar(location.query.query);
  const conditions = new MutableSearch(queryString ?? '');

  conditions.addFilterValues('!transaction', [transaction]);

  const query = conditions.formatString();

  browserHistory.push({
    pathname: location.pathname,
    query: {
      ...location.query,
      query: String(query).trim(),
    },
  });
}

function handleFilterDuration(
  location: Location,
  value: number,
  symbol: FilterSymbols,
  projects: Project[],
  projectIds: Readonly<number[]>
) {
  const durationTag = getCurrentTrendParameter(location, projects, projectIds).column;
  const queryString = decodeScalar(location.query.query);
  const conditions = new MutableSearch(queryString ?? '');

  const existingValues = conditions.getFilterValues(durationTag);
  const alternateSymbol = symbol === FilterSymbols.GREATER_THAN_EQUALS ? '>' : '<';

  if (existingValues) {
    existingValues.forEach(existingValue => {
      if (existingValue.startsWith(symbol) || existingValue.startsWith(alternateSymbol)) {
        conditions.removeFilterValue(durationTag, existingValue);
      }
    });
  }

  conditions.addFilterValues(durationTag, [`${symbol}${value}`]);

  const query = conditions.formatString();

  browserHistory.push({
    pathname: location.pathname,
    query: {
      ...location.query,
      query: String(query).trim(),
    },
  });
}

function ChangedTransactions(props: Props) {
  const {
    location,
    trendChangeType,
    previousTrendFunction,
    previousTrendColumn,
    organization,
    projects,
    setError,
  } = props;
  const api = useApi();

  const trendView = props.trendView.clone();
  const chartTitle = getChartTitle(trendChangeType);
  modifyTrendView(trendView, location, trendChangeType, projects);

  const onCursor = makeTrendsCursorHandler(trendChangeType);
  const cursor = decodeScalar(location.query[trendCursorNames[trendChangeType]]);

  return (
    <TrendsDiscoverQuery
      eventView={trendView}
      orgSlug={organization.slug}
      location={location}
      trendChangeType={trendChangeType}
      cursor={cursor}
      limit={5}
      setError={setError}
    >
      {({isLoading, trendsData, pageLinks}) => {
        const trendFunction = getCurrentTrendFunction(location);
        const trendParameter = getCurrentTrendParameter(
          location,
          projects,
          trendView.project
        );
        const events = normalizeTrends(
          (trendsData && trendsData.events && trendsData.events.data) || []
        );
        const selectedTransaction = getSelectedTransaction(
          location,
          trendChangeType,
          events
        );

        const statsData = trendsData?.stats || {};
        const transactionsList = events && events.slice ? events.slice(0, 5) : [];

        const currentTrendFunction =
          isLoading && previousTrendFunction
            ? previousTrendFunction
            : trendFunction.field;

        const currentTrendColumn =
          isLoading && previousTrendColumn ? previousTrendColumn : trendParameter.column;

        const titleTooltipContent = t(
          'This compares the baseline (%s) of the past with the present.',
          trendFunction.legendLabel
        );

        return (
          <TransactionsListContainer>
            <TrendsTransactionPanel>
              <StyledHeaderTitleLegend>
                {chartTitle}
                <QuestionTooltip size="sm" position="top" title={titleTooltipContent} />
              </StyledHeaderTitleLegend>
              {isLoading ? (
                <LoadingIndicator
                  style={{
                    margin: '237px auto',
                  }}
                />
              ) : (
                <Fragment>
                  {transactionsList.length ? (
                    <Fragment>
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
                          currentTrendColumn={currentTrendColumn}
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
                            trendChangeType
                          )}
                        />
                      ))}
                    </Fragment>
                  ) : (
                    <StyledEmptyStateWarning small>
                      {t('No results')}
                    </StyledEmptyStateWarning>
                  )}
                </Fragment>
              )}
            </TrendsTransactionPanel>
            <Pagination pageLinks={pageLinks} onCursor={onCursor} />
          </TransactionsListContainer>
        );
      }}
    </TrendsDiscoverQuery>
  );
}

type TrendsListItemProps = {
  api: Client;
  currentTrendColumn: string;
  currentTrendFunction: string;
  handleSelectTransaction: (transaction: NormalizedTrendsTransaction) => void;
  index: number;
  location: Location;
  organization: Organization;
  projects: Project[];
  statsData: TrendsStats;
  transaction: NormalizedTrendsTransaction;
  transactions: NormalizedTrendsTransaction[];
  trendChangeType: TrendChangeType;
  trendView: TrendView;
};

function TrendsListItem(props: TrendsListItemProps) {
  const {
    transaction,
    transactions,
    trendChangeType,
    currentTrendFunction,
    currentTrendColumn,
    index,
    location,
    projects,
    handleSelectTransaction,
    trendView,
  } = props;
  const color = trendToColor[trendChangeType].default;

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

  const absolutePercentChange = formatPercentage(
    Math.abs(transaction.trend_percentage - 1),
    0
  );

  const previousDuration = getDuration(
    previousPeriodValue / 1000,
    previousPeriodValue < 1000 && previousPeriodValue > 10 ? 0 : 2
  );
  const currentDuration = getDuration(
    currentPeriodValue / 1000,
    currentPeriodValue < 1000 && currentPeriodValue > 10 ? 0 : 2
  );

  const percentChangeExplanation = t(
    'Over this period, the %s for %s has %s %s from %s to %s',
    currentTrendFunction,
    currentTrendColumn,
    trendChangeType === TrendChangeType.IMPROVED ? t('decreased') : t('increased'),
    absolutePercentChange,
    previousDuration,
    currentDuration
  );

  const longestPeriodValue =
    trendChangeType === TrendChangeType.IMPROVED
      ? previousPeriodValue
      : currentPeriodValue;
  const longestDuration =
    trendChangeType === TrendChangeType.IMPROVED ? previousDuration : currentDuration;

  return (
    <ListItemContainer data-test-id={'trends-list-item-' + trendChangeType}>
      <ItemRadioContainer color={color}>
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
          disableForVisualTest // Disabled tooltip in snapshots because of overlap order issues.
        >
          <RadioLineItem index={index} role="radio">
            <Radio
              checked={isSelected}
              onChange={() => handleSelectTransaction(transaction)}
            />
          </RadioLineItem>
        </Tooltip>
      </ItemRadioContainer>
      <TransactionSummaryLink {...props} />
      <ItemTransactionPercentage>
        <Tooltip title={percentChangeExplanation}>
          <Fragment>
            {trendChangeType === TrendChangeType.REGRESSION ? '+' : ''}
            {formatPercentage(transaction.trend_percentage - 1, 0)}
          </Fragment>
        </Tooltip>
      </ItemTransactionPercentage>
      <DropdownLink
        caret={false}
        anchorRight
        title={
          <StyledButton
            size="xsmall"
            icon={<IconEllipsis data-test-id="trends-item-action" size="xs" />}
            aria-label={t('Actions')}
          />
        }
      >
        <MenuItem
          onClick={() =>
            handleFilterDuration(
              location,
              longestPeriodValue,
              FilterSymbols.LESS_THAN_EQUALS,
              projects,
              trendView.project
            )
          }
        >
          <StyledMenuAction>{t('Show \u2264 %s', longestDuration)}</StyledMenuAction>
        </MenuItem>
        <MenuItem
          onClick={() =>
            handleFilterDuration(
              location,
              longestPeriodValue,
              FilterSymbols.GREATER_THAN_EQUALS,
              projects,
              trendView.project
            )
          }
        >
          <StyledMenuAction>{t('Show \u2265 %s', longestDuration)}</StyledMenuAction>
        </MenuItem>
        <MenuItem
          onClick={() => handleFilterTransaction(location, transaction.transaction)}
        >
          <StyledMenuAction>{t('Hide from list')}</StyledMenuAction>
        </MenuItem>
      </DropdownLink>
      <ItemTransactionDurationChange>
        {project && (
          <Tooltip title={transaction.project}>
            <IdBadge avatarSize={16} project={project} hideName />
          </Tooltip>
        )}
        <CompareDurations {...props} />
      </ItemTransactionDurationChange>
      <ItemTransactionStatus color={color}>
        <ValueDelta {...props} />
      </ItemTransactionStatus>
    </ListItemContainer>
  );
}

export const CompareDurations = ({
  transaction,
}: {
  transaction: TrendsListItemProps['transaction'];
}) => {
  const {fromSeconds, toSeconds, showDigits} = transformDeltaSpread(
    transaction.aggregate_range_1,
    transaction.aggregate_range_2
  );

  return (
    <DurationChange>
      <Duration seconds={fromSeconds} fixedDigits={showDigits ? 1 : 0} abbreviation />
      <StyledIconArrow direction="right" size="xs" />
      <Duration seconds={toSeconds} fixedDigits={showDigits ? 1 : 0} abbreviation />
    </DurationChange>
  );
};

const ValueDelta = ({transaction, trendChangeType}: TrendsListItemProps) => {
  const {seconds, fixedDigits, changeLabel} = transformValueDelta(
    transaction.trend_difference,
    trendChangeType
  );

  return (
    <span>
      <Duration seconds={seconds} fixedDigits={fixedDigits} abbreviation /> {changeLabel}
    </span>
  );
};

type TransactionSummaryLinkProps = TrendsListItemProps & {};

const TransactionSummaryLink = (props: TransactionSummaryLinkProps) => {
  const {
    organization,
    trendView: eventView,
    transaction,
    projects,
    currentTrendFunction,
    currentTrendColumn,
  } = props;
  const summaryView = eventView.clone();
  const projectID = getTrendProjectId(transaction, projects);
  const target = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction: String(transaction.transaction),
    query: summaryView.generateQueryStringObject(),
    projectID,
    display: DisplayModes.TREND,
    trendFunction: currentTrendFunction,
    trendColumn: currentTrendColumn,
  });

  return <ItemTransactionName to={target}>{transaction.transaction}</ItemTransactionName>;
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
  border-radius: ${p => p.theme.borderRadius};
  margin: ${space(2)} ${space(3)};
`;

const StyledButton = styled(Button)`
  vertical-align: middle;
`;

const StyledMenuAction = styled('div')`
  white-space: nowrap;
  color: ${p => p.theme.textColor};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  min-height: 300px;
  justify-content: center;
`;

const ListItemContainer = styled('div')`
  display: grid;
  grid-template-columns: 24px auto 100px 30px;
  grid-template-rows: repeat(2, auto);
  grid-column-gap: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
`;

const ItemRadioContainer = styled('div')`
  grid-row: 1/3;
  input {
    cursor: pointer;
  }
  input:checked::after {
    background-color: ${p => p.color};
  }
`;

const ItemTransactionName = styled(Link)`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(1)};
  ${overflowEllipsis};
`;

const ItemTransactionDurationChange = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DurationChange = styled('span')`
  color: ${p => p.theme.gray300};
  margin: 0 ${space(1)};
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

const StyledIconArrow = styled(IconArrow)`
  margin: 0 ${space(1)};
`;

export default withProjects(withOrganization(ChangedTransactions));
