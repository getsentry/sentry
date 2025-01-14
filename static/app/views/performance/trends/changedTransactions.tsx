import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Duration from 'sentry/components/duration';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import getSelectedQueryKey from 'sentry/views/performance/trends/utils/getSelectedQueryKey';
import {getSelectedTransaction} from 'sentry/views/performance/utils/getSelectedTransaction';

import Chart from './chart';
import type {
  NormalizedTrendsTransaction,
  TrendFunctionField,
  TrendParameterColumn,
  TrendView,
} from './types';
import {TrendChangeType} from './types';
import {
  getCurrentTrendFunction,
  getCurrentTrendParameter,
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
  previousTrendColumn?: TrendParameterColumn;
  previousTrendFunction?: TrendFunctionField;
  withBreakpoint?: boolean;
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

function handleChangeSelected(
  location: Location,
  organization: Organization,
  trendChangeType: TrendChangeType
) {
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

    trackAnalytics('performance_views.trends.widget_interaction', {
      organization,
      widget_type: trendChangeType,
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
  organization: Organization,
  value: number,
  symbol: FilterSymbols,
  trendChangeType: TrendChangeType,
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

  trackAnalytics('performance_views.trends.change_duration', {
    organization,
    widget_type: getChartTitle(trendChangeType),
    value: `${symbol}${value}`,
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
    withBreakpoint,
  } = props;
  const api = useApi();

  const {isLoading: isCardinalityCheckLoading, outcome} = useMetricsCardinalityContext();

  const canUseMetricsTrends = withBreakpoint && !outcome?.forceTransactionsOnly;

  const trendView = props.trendView.clone();
  const chartTitle = getChartTitle(trendChangeType);
  modifyTrendView(trendView, location, trendChangeType, projects, canUseMetricsTrends);

  const onCursor = makeTrendsCursorHandler(trendChangeType);
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const cursor = decodeScalar(location.query[trendCursorNames[trendChangeType]]);
  const paginationAnalyticsEvent = (direction: string) => {
    trackAnalytics('performance_views.trends.widget_pagination', {
      organization,
      direction,
      widget_type: getChartTitle(trendChangeType),
    });
  };

  return (
    <TrendsDiscoverQuery
      eventView={trendView}
      orgSlug={organization.slug}
      location={location}
      trendChangeType={trendChangeType}
      cursor={cursor}
      limit={5}
      setError={error => setError(error?.message)}
      withBreakpoint={canUseMetricsTrends}
    >
      {({isLoading, trendsData, pageLinks}) => {
        const trendFunction = getCurrentTrendFunction(location);
        const trendParameter = getCurrentTrendParameter(
          location,
          projects,
          trendView.project
        );
        const events = normalizeTrends(trendsData?.events?.data || []);
        const selectedTransaction = getSelectedTransaction(
          location,
          trendChangeType,
          events
        );

        const statsData = trendsData?.stats || {};
        const transactionsList = events?.slice ? events.slice(0, 5) : [];

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
          <TransactionsListContainer data-test-id="changed-transactions">
            <TrendsTransactionPanel>
              <StyledHeaderTitleLegend>
                {chartTitle}
                <QuestionTooltip size="sm" position="top" title={titleTooltipContent} />
              </StyledHeaderTitleLegend>
              {isLoading || isCardinalityCheckLoading ? (
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
                          trendView={trendView}
                          organization={organization}
                          transaction={transaction}
                          key={transaction.transaction}
                          index={index}
                          trendChangeType={trendChangeType}
                          transactions={transactionsList}
                          location={location}
                          projects={projects}
                          handleSelectTransaction={handleChangeSelected(
                            location,
                            organization,
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
            <Pagination
              pageLinks={pageLinks}
              onCursor={onCursor}
              paginationAnalyticsEvent={paginationAnalyticsEvent}
            />
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
    organization,
    projects,
    handleSelectTransaction,
    trendView,
  } = props;
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
    <Fragment>
      <ListItemContainer data-test-id={'trends-list-item-' + trendChangeType}>
        <ItemRadioContainer color={color}>
          {transaction.count_range_1 && transaction.count_range_2 ? (
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
              <RadioLineItem index={index} role="radio">
                <Radio
                  checked={isSelected}
                  onChange={() => handleSelectTransaction(transaction)}
                />
              </RadioLineItem>
            </Tooltip>
          ) : (
            <RadioLineItem index={index} role="radio">
              <Radio
                checked={isSelected}
                onChange={() => handleSelectTransaction(transaction)}
              />
            </RadioLineItem>
          )}
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
        <DropdownMenu
          triggerProps={{
            size: 'xs',
            icon: <IconEllipsis />,
            'aria-label': t('Actions'),
            showChevron: false,
          }}
          items={[
            ...(organization.features.includes('performance-new-trends')
              ? []
              : [
                  {
                    key: 'shortestDuration',
                    label: t('Show \u2264 %s', longestDuration),
                    onAction: () =>
                      handleFilterDuration(
                        location,
                        organization,
                        longestPeriodValue,
                        FilterSymbols.LESS_THAN_EQUALS,
                        trendChangeType,
                        projects,
                        trendView.project
                      ),
                  },
                  {
                    key: 'longestDuration',
                    label: t('Show \u2265 %s', longestDuration),
                    onAction: () =>
                      handleFilterDuration(
                        location,
                        organization,
                        longestPeriodValue,
                        FilterSymbols.GREATER_THAN_EQUALS,
                        trendChangeType,
                        projects,
                        trendView.project
                      ),
                  },
                ]),
            {
              key: 'hide',
              label: t('Hide from list'),
              onAction: () => handleFilterTransaction(location, transaction.transaction),
            },
          ]}
          position="bottom-end"
        />
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
    </Fragment>
  );
}

export function CompareDurations({
  transaction,
}: {
  transaction: TrendsListItemProps['transaction'];
}) {
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
}

function ValueDelta({transaction, trendChangeType}: TrendsListItemProps) {
  const {seconds, fixedDigits, changeLabel} = transformValueDelta(
    transaction.trend_difference,
    trendChangeType
  );

  return (
    <span>
      <Duration seconds={seconds} fixedDigits={fixedDigits} abbreviation /> {changeLabel}
    </span>
  );
}

type TransactionSummaryLinkProps = TrendsListItemProps;

function TransactionSummaryLink(props: TransactionSummaryLinkProps) {
  const {
    organization,
    trendView: eventView,
    transaction,
    projects,
    location,
    currentTrendFunction,
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
    additionalQuery: {
      trendParameter: location.query.trendParameter?.toString(),
    },
  });

  const handleClick = useCallback<React.MouseEventHandler>(
    event => {
      event.preventDefault();
      trackAnalytics('performance_views.performance_change_explorer.open', {
        organization,
        transaction: transaction.transaction,
      });
    },
    [transaction.transaction, organization]
  );

  if (organization.features.includes('performance-change-explorer')) {
    return (
      <ItemTransactionName
        to={location}
        data-test-id="item-transaction-name"
        onClick={handleClick}
      >
        {transaction.transaction}
      </ItemTransactionName>
    );
  }
  return (
    <ItemTransactionName to={target} data-test-id="item-transaction-name">
      {transaction.transaction}
    </ItemTransactionName>
  );
}

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

const MenuAction = styled('div')<{['data-test-id']?: string}>`
  white-space: nowrap;
  color: ${p => p.theme.textColor};
`;

MenuAction.defaultProps = {
  'data-test-id': 'menu-action',
};

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
  ${p => p.theme.overflowEllipsis};
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
