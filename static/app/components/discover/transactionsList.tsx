import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import type {Location, LocationDescriptor} from 'history';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {CursorHandler} from '@sentry/scraps/pagination';
import {Pagination} from '@sentry/scraps/pagination';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {DiscoverButton} from 'sentry/components/discoverButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import {decodeColumnOrder} from 'sentry/utils/discover/decodeColumnOrder';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {DiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import type {EventView} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {isAggregateField, parseFunction} from 'sentry/utils/discover/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import {getPaginationProps} from 'sentry/utils/pagination';
import {TrendsEventsDiscoverQuery} from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {TrendChangeType, TrendView} from 'sentry/views/performance/trends/types';

import {TransactionsTable} from './transactionsTable';

const DEFAULT_TRANSACTION_LIMIT = 5;
const TRANSACTION_CURSOR_NAME = 'transactionCursor';

/**
 * Normalize an aggregate yAxis so it carries an explicit column argument where
 * the spans dataset requires one (e.g. `p50()` -> `p50(span.duration)`).
 */
function normalizeExploreYAxis(yAxis: string): string {
  const parsed = parseFunction(yAxis);
  if (!parsed || parsed.arguments.length > 0) {
    return yAxis;
  }

  const definition = getFieldDefinition(parsed.name, 'span');
  const columnParameter = definition?.parameters?.find(
    parameter => parameter.kind === 'column'
  );
  if (columnParameter?.defaultValue) {
    return `${parsed.name}(${columnParameter.defaultValue})`;
  }

  return yAxis;
}

/**
 * Build an Explore > Traces URL that reproduces the aggregate view described by
 * the given (spans dataset) EventView.
 */
function getExploreTarget(eventView: EventView, organization: Organization): string {
  const fields = eventView.getFields();
  const groupBy = fields.filter(field => !isAggregateField(field));
  const yAxes = fields.filter(isAggregateField).map(normalizeExploreYAxis);

  const sort = eventView.sorts[0];
  let aggregateSort: string | undefined;
  if (sort) {
    const sortedYAxis = yAxes.find(yAxis => parseFunction(yAxis)?.name === sort.field);
    if (sortedYAxis) {
      aggregateSort = `${sort.kind === 'desc' ? '-' : ''}${sortedYAxis}`;
    }
  }

  // Explore's search cannot express aggregate (HAVING) conditions such as
  // `epm():>0.01`.
  const search = new MutableSearch(eventView.query);
  Object.keys(search.filters).forEach(key => {
    if (isAggregateField(key)) {
      search.removeFilter(key);
    }
  });

  return getExploreUrl({
    organization,
    selection: eventView.getPageFilters(),
    mode: Mode.AGGREGATE,
    query: search.formatString(),
    groupBy,
    visualize: yAxes.length > 0 ? [{yAxes}] : undefined,
    aggregateSort,
  });
}

export type DropdownOption = {
  /**
   * The label to display in the dropdown
   */
  label: string;
  /**
   * The sort to apply to the eventView when this is selected.
   */
  sort: Sort;
  /**
   * The unique name to use for this option.
   */
  value: string;
  /**
   * override the eventView query
   */
  query?: Array<[string, string]>;
  /**
   * Included if the option is for a trend
   */
  trendType?: TrendChangeType;
};

type Props = {
  eventView: EventView;
  /**
   * The callback for when the dropdown option changes.
   */
  handleDropdownChange: (k: string) => void;
  location: Location;
  navigate: ReactRouter3Navigate;
  /**
   * The available options for the dropdown.
   */
  options: DropdownOption[];
  organization: Organization;
  /**
   * The currently selected option on the dropdown.
   */
  selected: DropdownOption;
  /**
   * A map of callbacks to generate a link for a column based on the title.
   */
  generateLink?: Record<
    string,
    (
      organization: Organization,
      tableRow: TableDataRow,
      location: Location
    ) => LocationDescriptor
  >;
  /**
   * A list of preferred table headers to use over the field names.
   */
  titles?: string[];
  trendView?: TrendView;
};

type TableRenderProps = Omit<React.ComponentProps<typeof Pagination>, 'size'> &
  React.ComponentProps<typeof TransactionsTable> & {
    header: React.ReactNode;
    paginationCursorSize: React.ComponentProps<typeof Pagination>['size'];
    pageLinks?: string | null;
  };

function TableRender({
  pageLinks,
  onCursor,
  header,
  eventView,
  organization,
  isLoading,
  location,
  columnOrder,
  tableData,
  titles,
  generateLink,
  useAggregateAlias,
  paginationCursorSize,
}: TableRenderProps) {
  return (
    <Fragment>
      <Grid
        align="center"
        columns={{zero: '1fr', md: '1fr auto'}}
        gap="md"
        marginBottom="md"
      >
        {header}
        <Pagination
          {...getPaginationProps(pageLinks)}
          onCursor={onCursor}
          size={paginationCursorSize}
          css={css`
            margin: 0;
          `}
        />
      </Grid>
      <DemoTourElement
        id={DemoTourStep.PERFORMANCE_TRANSACTION_SUMMARY_TABLE}
        title={t('Breakdown event spans')}
        description={t(
          'Select an Event ID from a list of slow transactions to uncover slow spans.'
        )}
      >
        {props => (
          <div {...props}>
            <TransactionsTable
              eventView={eventView}
              organization={organization}
              location={location}
              isLoading={isLoading}
              tableData={tableData}
              columnOrder={columnOrder}
              titles={titles}
              generateLink={generateLink}
              useAggregateAlias={useAggregateAlias}
            />
          </div>
        )}
      </DemoTourElement>
    </Fragment>
  );
}

class _TransactionsList extends Component<Props> {
  handleCursor: CursorHandler = cursor => {
    const {pathname, query} = this.props.location;
    const {navigate} = this.props;
    navigate({pathname, query: {...query, [TRANSACTION_CURSOR_NAME]: cursor}});
  };

  getEventView() {
    const {eventView, selected} = this.props;

    const sortedEventView = eventView.withSorts([selected.sort]);
    if (selected.query) {
      const query = new MutableSearch(sortedEventView.query);
      selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      sortedEventView.query = query.formatString();
    }

    return sortedEventView;
  }

  renderHeader(): React.ReactNode {
    const {organization, selected, options, handleDropdownChange} = this.props;
    return (
      <Grid columns={{zero: '1fr', md: 'repeat(2, max-content)'}} gap="md">
        <Container width={{zero: '100%', md: 'max-content'}}>
          {containerProps => (
            <CompactSelect
              {...containerProps}
              trigger={triggerProps => (
                <OverlayTrigger.Button
                  {...triggerProps}
                  prefix={t('Filter')}
                  size="xs"
                  style={{width: '100%'}}
                />
              )}
              value={selected.value}
              options={options}
              onChange={opt => handleDropdownChange(opt.value)}
            />
          )}
        </Container>
        {!this.isTrend() && (
          <GuideAnchor target="release_transactions_open_in_discover">
            <DiscoverButton
              to={getExploreTarget(this.getEventView(), organization)}
              size="xs"
              data-test-id="discover-open"
            >
              {t('Open in Explore')}
            </DiscoverButton>
          </GuideAnchor>
        )}
      </Grid>
    );
  }

  renderTransactionTable(): React.ReactNode {
    const {location, organization, titles, generateLink} = this.props;

    const eventView = this.getEventView();
    const cursor = decodeScalar(location.query?.[TRANSACTION_CURSOR_NAME]);

    return (
      <DiscoverQuery
        location={location}
        eventView={eventView}
        orgSlug={organization.slug}
        limit={DEFAULT_TRANSACTION_LIMIT}
        cursor={cursor}
        referrer="api.discover.transactions-list"
      >
        {({isLoading, pageLinks, tableData}) => (
          <TableRender
            eventView={eventView}
            organization={organization}
            location={location}
            columnOrder={eventView.getColumns()}
            titles={titles}
            generateLink={generateLink}
            useAggregateAlias={false}
            paginationCursorSize="xs"
            onCursor={this.handleCursor}
            isLoading={isLoading}
            pageLinks={pageLinks}
            tableData={tableData}
            header={this.renderHeader()}
          />
        )}
      </DiscoverQuery>
    );
  }

  renderTrendsTable(): React.ReactNode {
    const {trendView, location, selected, organization, generateLink} = this.props;

    const sortedEventView: TrendView = trendView!.clone();
    sortedEventView.sorts = [selected.sort];
    sortedEventView.trendType = selected.trendType;
    if (selected.query) {
      const query = new MutableSearch(sortedEventView.query);
      selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      sortedEventView.query = query.formatString();
    }
    const cursor = decodeScalar(location.query?.[TRANSACTION_CURSOR_NAME]);

    return (
      <TrendsEventsDiscoverQuery
        eventView={sortedEventView}
        orgSlug={organization.slug}
        location={location}
        cursor={cursor}
        limit={5}
      >
        {({isLoading, trendsData, pageLinks}) => (
          <TableRender
            organization={organization}
            eventView={sortedEventView}
            location={location}
            isLoading={isLoading}
            tableData={trendsData}
            pageLinks={pageLinks}
            onCursor={this.handleCursor}
            paginationCursorSize="sm"
            header={this.renderHeader()}
            titles={['transaction', 'percentage', 'difference']}
            columnOrder={decodeColumnOrder([
              {field: 'transaction'},
              {field: 'trend_percentage()'},
              {field: 'trend_difference()'},
            ])}
            generateLink={generateLink}
            useAggregateAlias
          />
        )}
      </TrendsEventsDiscoverQuery>
    );
  }

  isTrend(): boolean {
    const {selected} = this.props;
    return selected.trendType !== undefined;
  }

  render() {
    return (
      <Fragment>
        {this.isTrend() ? this.renderTrendsTable() : this.renderTransactionTable()}
      </Fragment>
    );
  }
}

export function TransactionsList(props: Omit<Props, 'navigate'>) {
  const navigate = useNavigate();
  return <_TransactionsList {...props} navigate={navigate} />;
}
