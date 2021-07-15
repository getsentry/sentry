import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject, Query} from 'history';

import Feature from 'app/components/acl/feature';
import {GuideAnchor} from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import FeatureBadge from 'app/components/featureBadge';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
  GridColumnOrder,
} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView, {fromSorts, isFieldSortable} from 'app/utils/discover/eventView';
import {fieldAlignment} from 'app/utils/discover/fields';
import {formatPercentage} from 'app/utils/formatters';
import SegmentExplorerQuery, {
  TableData,
  TableDataRow,
} from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {
  PerformanceDuration,
  platformAndConditionsToPerformanceType,
  PROJECT_PERFORMANCE_TYPE,
} from '../utils';

import {tagsRouteWithQuery} from './transactionTags/utils';
import {SpanOperationBreakdownFilter} from './filter';

const TAGS_CURSOR_NAME = 'tags_cursor';

type ColumnKeys =
  | 'key'
  | 'tagValue'
  | 'aggregate'
  | 'frequency'
  | 'comparison'
  | 'sumdelta';
type TagColumn = GridColumnOrder<ColumnKeys> & {
  column: {
    kind: string;
  };
  field: string;
  canSort?: boolean;
};
const COLUMN_ORDER: TagColumn[] = [
  {
    key: 'key',
    field: 'key',
    name: 'Tag Key',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'tagValue',
    field: 'tagValue',
    name: 'Tag Values',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'aggregate',
    field: 'aggregate',
    name: 'Avg Duration',
    width: -1,
    column: {
      kind: 'field',
    },
    canSort: true,
  },
  {
    key: 'frequency',
    field: 'frequency',
    name: 'Frequency',
    width: -1,
    column: {
      kind: 'field',
    },
    canSort: true,
  },
  {
    key: 'comparison',
    field: 'comparison',
    name: 'Compared To Avg',
    width: -1,
    column: {
      kind: 'field',
    },
    canSort: true,
  },
  {
    key: 'sumdelta',
    field: 'sumdelta',
    name: 'Total Time Lost',
    width: -1,
    column: {
      kind: 'field',
    },
    canSort: true,
  },
];

const filterToField = {
  [SpanOperationBreakdownFilter.Browser]: 'spans.browser',
  [SpanOperationBreakdownFilter.Http]: 'spans.http',
  [SpanOperationBreakdownFilter.Db]: 'spans.db',
  [SpanOperationBreakdownFilter.Resource]: 'spans.resource',
};

export const getTransactionField = (
  currentFilter: SpanOperationBreakdownFilter,
  projects: Project[],
  eventView: EventView
) => {
  const fieldFromFilter = filterToField[currentFilter];
  if (fieldFromFilter) {
    return fieldFromFilter;
  }

  const performanceType = platformAndConditionsToPerformanceType(projects, eventView);
  if (performanceType === PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    return 'measurements.lcp';
  }

  return 'transaction.duration';
};

const getColumnsWithReplacedDuration = (
  currentFilter: SpanOperationBreakdownFilter,
  projects: Project[],
  eventView: EventView
) => {
  const columns = COLUMN_ORDER.map(c => ({...c}));
  const durationColumn = columns.find(c => c.key === 'aggregate');

  if (!durationColumn) {
    return columns;
  }

  const fieldFromFilter = filterToField[currentFilter];
  if (fieldFromFilter) {
    durationColumn.name = 'Avg Span Duration';
    return columns;
  }

  const performanceType = platformAndConditionsToPerformanceType(projects, eventView);
  if (performanceType === PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    durationColumn.name = 'Avg LCP';
    return columns;
  }

  return columns;
};

type TagValueProps = {
  row: TableDataRow;
};

export function TagValue(props: TagValueProps) {
  return <div className="truncate">{props.row.tags_value}</div>;
}

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  projects: Project[];
  transactionName: string;
  currentFilter: SpanOperationBreakdownFilter;
};

type State = {
  widths: number[];
};
class _TagExplorer extends React.Component<Props> {
  state: State = {
    widths: [],
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({widths});
  };

  getColumnOrder = (columns: GridColumnOrder[]) => {
    const {widths} = this.state;
    return columns.map((col: GridColumnOrder, i: number) => {
      if (typeof widths[i] === 'number') {
        return {...col, width: widths[i]};
      }
      return col;
    });
  };

  onSortClick(currentSortKind?: string, currentSortField?: string) {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.tag_explorer.sort',
      eventName: 'Performance Views: Tag Explorer Sorted',
      organization_id: parseInt(organization.id, 10),
      field: currentSortField,
      direction: currentSortKind,
    });
  }

  renderHeadCell(
    sortedEventView: EventView,
    tableMeta: TableData['meta'],
    column: TableColumn<ColumnKeys>,
    columnInfo: TagColumn
  ): React.ReactNode {
    const {location} = this.props;
    const align = fieldAlignment(column.key, column.type, tableMeta);
    const field = {field: column.key, width: column.width};

    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = sortedEventView.sortOnField(field, tableMeta);
      const {sort} = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, [TAGS_CURSOR_NAME]: undefined, tagSort: sort},
      };
    }
    const currentSort = sortedEventView.sortForField(field, tableMeta);
    const canSort = isFieldSortable(field, tableMeta);

    const currentSortKind = currentSort ? currentSort.kind : undefined;
    const currentSortField = currentSort ? currentSort.field : undefined;

    return (
      <SortLink
        align={align}
        title={columnInfo.name}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
        onClick={() => this.onSortClick(currentSortKind, currentSortField)}
      />
    );
  }

  renderHeadCellWithMeta = (
    sortedEventView: EventView,
    tableMeta: TableData['meta'],
    columns: TagColumn[]
  ) => {
    return (column: TableColumn<ColumnKeys>, index: number): React.ReactNode =>
      this.renderHeadCell(sortedEventView, tableMeta, column, columns[index]);
  };

  handleTagValueClick = (location: Location, tagKey: string, tagValue: string) => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.tag_explorer.tag_value',
      eventName: 'Performance Views: Tag Explorer Value Clicked',
      organization_id: parseInt(organization.id, 10),
    });

    const queryString = decodeScalar(location.query.query);
    const conditions = tokenizeSearch(queryString || '');

    conditions.addTagValues(tagKey, [tagValue]);

    const query = conditions.formatString();
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: String(query).trim(),
      },
    });
  };

  handleCellAction = (
    column: TableColumn<ColumnKeys>,
    tagValue: React.ReactText,
    actionRow: any
  ) => {
    return (action: Actions) => {
      const {eventView, location, organization} = this.props;
      trackAnalyticsEvent({
        eventKey: 'performance_views.summary.tag_explorer.cell_action',
        eventName: 'Performance Views: Tag Explorer Cell Action Clicked',
        organization_id: parseInt(organization.id, 10),
      });

      const searchConditions = tokenizeSearch(eventView.query);

      // remove any event.type queries since it is implied to apply to only transactions
      searchConditions.removeTag('event.type');

      updateQuery(searchConditions, action, {...column, name: actionRow.id}, tagValue);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          [TAGS_CURSOR_NAME]: undefined,
          query: searchConditions.formatString(),
        },
      });
    };
  };

  onTagKeyClick() {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.tag_explorer.visit_tag_key',
      eventName: 'Performance Views: Tag Explorer - Visit Tag Key',
      organization_id: parseInt(organization.id, 10),
    });
  }

  renderBodyCell = (
    parentProps: Props,
    column: TableColumn<ColumnKeys>,
    dataRow: TableDataRow
  ): React.ReactNode => {
    const value = dataRow[column.key];
    const {location, organization, transactionName} = parentProps;

    if (column.key === 'key') {
      const target = tagsRouteWithQuery({
        orgSlug: organization.slug,
        transaction: transactionName,
        projectID: decodeScalar(location.query.project),
        query: {...location.query, tagKey: dataRow.tags_key},
      });
      return (
        <Feature features={['performance-tag-page']} organization={organization}>
          {({hasFeature}) => {
            if (hasFeature) {
              return (
                <Link to={target} onClick={() => this.onTagKeyClick()}>
                  {dataRow.tags_key}
                </Link>
              );
            }
            return dataRow.tags_key;
          }}
        </Feature>
      );
    }

    const allowActions = [Actions.ADD, Actions.EXCLUDE];

    if (column.key === 'tagValue') {
      const actionRow = {...dataRow, id: dataRow.tags_key};
      return (
        <CellAction
          column={column}
          dataRow={actionRow}
          handleCellAction={this.handleCellAction(column, dataRow.tags_value, actionRow)}
          allowActions={allowActions}
        >
          <Feature features={['performance-tag-page']} organization={organization}>
            {({hasFeature}) => {
              if (hasFeature) {
                return <div className="truncate">{dataRow.tags_value}</div>;
              }
              return (
                <Link
                  to=""
                  onClick={() =>
                    this.handleTagValueClick(
                      location,
                      dataRow.tags_key,
                      dataRow.tags_value
                    )
                  }
                >
                  <TagValue row={dataRow} />
                </Link>
              );
            }}
          </Feature>
        </CellAction>
      );
    }

    if (column.key === 'frequency') {
      return <AlignRight>{formatPercentage(dataRow.frequency, 0)}</AlignRight>;
    }

    if (column.key === 'comparison') {
      const localValue = dataRow.comparison;
      const pct = formatPercentage(localValue - 1, 0);
      return (
        <AlignRight>
          {localValue > 1 ? t('+%s slower', pct) : t('%s faster', pct)}
        </AlignRight>
      );
    }

    if (column.key === 'aggregate') {
      return (
        <AlignRight>
          <PerformanceDuration abbreviation milliseconds={dataRow.aggregate} />
        </AlignRight>
      );
    }

    if (column.key === 'sumdelta') {
      return (
        <AlignRight>
          <PerformanceDuration abbreviation milliseconds={dataRow.sumdelta} />
        </AlignRight>
      );
    }
    return value;
  };

  renderBodyCellWithData = (parentProps: Props) => {
    return (column: TableColumn<ColumnKeys>, dataRow: TableDataRow): React.ReactNode =>
      this.renderBodyCell(parentProps, column, dataRow);
  };

  render() {
    const {eventView, organization, location, currentFilter, projects, transactionName} =
      this.props;

    const tagSort = decodeScalar(location.query?.tagSort);
    const cursor = decodeScalar(location.query?.[TAGS_CURSOR_NAME]);

    const tagEventView = eventView.clone();
    tagEventView.fields = COLUMN_ORDER;

    const tagSorts = fromSorts(tagSort);

    const sortedEventView = tagEventView.withSorts(
      tagSorts.length
        ? tagSorts
        : [
            {
              field: 'sumdelta',
              kind: 'desc',
            },
          ]
    );

    const aggregateColumn = getTransactionField(currentFilter, projects, sortedEventView);

    const adjustedColumns = getColumnsWithReplacedDuration(
      currentFilter,
      projects,
      sortedEventView
    );
    const columns = this.getColumnOrder(adjustedColumns);

    const columnSortBy = sortedEventView.getSorts();

    return (
      <SegmentExplorerQuery
        eventView={sortedEventView}
        orgSlug={organization.slug}
        location={location}
        aggregateColumn={aggregateColumn}
        limit={5}
        cursor={cursor}
      >
        {({isLoading, tableData, pageLinks}) => {
          return (
            <React.Fragment>
              <GuideAnchor target="tag_explorer">
                <TagsHeader
                  transactionName={transactionName}
                  location={location}
                  organization={organization}
                  pageLinks={pageLinks}
                />
              </GuideAnchor>
              <GridEditable
                isLoading={isLoading}
                data={tableData && tableData.data ? tableData.data : []}
                columnOrder={columns}
                columnSortBy={columnSortBy}
                grid={{
                  renderHeadCell: this.renderHeadCellWithMeta(
                    sortedEventView,
                    tableData?.meta || {},
                    adjustedColumns
                  ) as any,
                  renderBodyCell: this.renderBodyCellWithData(this.props) as any,
                  onResizeColumn: this.handleResizeColumn as any,
                }}
                location={location}
              />
            </React.Fragment>
          );
        }}
      </SegmentExplorerQuery>
    );
  }
}

type HeaderProps = {
  organization: Organization;
  transactionName: string;
  location: Location;
  pageLinks: string | null;
};
function TagsHeader(props: HeaderProps) {
  const {pageLinks, organization, location, transactionName} = props;
  const handleCursor = (cursor: string, pathname: string, query: Query) => {
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.tag_explorer.change_page',
      eventName: 'Performance Views: Tag Explorer Change Page',
      organization_id: parseInt(organization.id, 10),
    });

    browserHistory.push({
      pathname,
      query: {...query, [TAGS_CURSOR_NAME]: cursor},
    });
  };

  const handleViewAllTagsClick = () => {
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.tag_explorer.change_page',
      eventName: 'Performance Views: Tag Explorer Change Page',
      organization_id: parseInt(organization.id, 10),
    });
  };

  const viewAllTarget = tagsRouteWithQuery({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: decodeScalar(location.query.project),
    query: {...location.query},
  });

  return (
    <Header>
      <div>
        <SectionHeading>{t('Suspect Tags')}</SectionHeading>
        <FeatureBadge type="beta" />
      </div>
      <Feature features={['performance-tag-page']} organization={organization}>
        <Button
          onClick={handleViewAllTagsClick}
          to={viewAllTarget}
          size="small"
          data-test-id="tags-explorer-open-tags"
        >
          {t('View All Tags')}
        </Button>
      </Feature>
      <StyledPagination pageLinks={pageLinks} onCursor={handleCursor} size="small" />
    </Header>
  );
}

const AlignRight = styled('div')`
  text-align: right;
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
  margin-bottom: ${space(1)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

export const TagExplorer = _TagExplorer;
