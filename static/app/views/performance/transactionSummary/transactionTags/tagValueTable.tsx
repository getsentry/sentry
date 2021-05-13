import React, {Component} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
  GridColumnOrder,
} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import {IconAdd} from 'app/icons/iconAdd';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView, {isFieldSortable} from 'app/utils/discover/eventView';
import {formatPercentage} from 'app/utils/formatters';
import SegmentExplorerQuery, {
  TableData,
  TableDataRow,
} from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {PerformanceDuration} from '../../utils';
import {SpanOperationBreakdownFilter} from '../filter';
import {getTransactionField, TagValue} from '../tagExplorer';

const TAGS_CURSOR_NAME = 'tags_cursor';

type ColumnKeys =
  | 'key'
  | 'tagValue'
  | 'aggregate'
  | 'frequency'
  | 'comparison'
  | 'sumdelta'
  | 'action'
  | 'count';
type TagColumn = GridColumnOrder<ColumnKeys> & {
  column: {
    kind: string;
  };
  field: string;
  canSort?: boolean;
};
const COLUMN_ORDER: TagColumn[] = [
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
    key: 'count',
    field: 'count',
    name: 'Events',
    width: -1,
    column: {
      kind: 'field',
    },
    canSort: true,
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
    key: 'action',
    field: 'action',
    name: '',
    width: -1,
    column: {
      kind: 'field',
    },
  },
];

type Props = {
  isLoading?: boolean;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  tagKey: string;
  eventView: EventView;
};

type State = {
  widths: number[];
};

export class TagValueTable extends Component<Props, State> {
  state: State = {
    widths: [],
  };
  renderHeadCell(
    sortedEventView: EventView,
    tableMeta: TableData['meta'],
    column: TableColumn<ColumnKeys>,
    columnInfo: TagColumn
  ): React.ReactNode {
    const {location} = this.props;
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

    return (
      <SortLink
        align="left"
        title={columnInfo.name}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
        onClick={() => {}}
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
    const queryString = decodeScalar(location.query.query);
    const conditions = tokenizeSearch(queryString || '');

    conditions.addTagValues(tagKey, [tagValue]);

    const query = stringifyQueryObject(conditions);
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
      const {eventView, location} = this.props;

      const searchConditions = tokenizeSearch(eventView.query);

      searchConditions.removeTag('event.type');

      updateQuery(searchConditions, action, {...column, name: actionRow.id}, tagValue);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          [TAGS_CURSOR_NAME]: undefined,
          query: stringifyQueryObject(searchConditions),
        },
      });
    };
  };

  renderBodyCell = (
    parentProps: Props,
    column: TableColumn<ColumnKeys>,
    dataRow: TableDataRow
  ): React.ReactNode => {
    const value = dataRow[column.key];
    const {location} = parentProps;

    if (column.key === 'key') {
      return dataRow.tags_key;
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
          <Link
            to=""
            onClick={() =>
              this.handleTagValueClick(location, dataRow.tags_key, dataRow.tags_value)
            }
          >
            <TagValue row={dataRow} />
          </Link>
        </CellAction>
      );
    }

    if (column.key === 'frequency') {
      return formatPercentage(dataRow.frequency, 0);
    }

    if (column.key === 'action') {
      return (
        <Link
          to=""
          onClick={() =>
            this.handleTagValueClick(location, dataRow.tags_key, dataRow.tags_value)
          }
        >
          <LinkContainer>
            <IconAdd isCircled /> {t('Add to filter')}
          </LinkContainer>
        </Link>
      );
    }

    if (column.key === 'comparison') {
      const localValue = dataRow.comparison;
      const pct = formatPercentage(localValue - 1, 0);
      return localValue > 1 ? t('+%s slower', pct) : t('%s faster', pct);
    }

    if (column.key === 'aggregate') {
      return <PerformanceDuration abbreviation milliseconds={dataRow.aggregate} />;
    }

    if (column.key === 'sumdelta') {
      return <PerformanceDuration abbreviation milliseconds={dataRow.sumdelta} />;
    }
    return value;
  };

  renderBodyCellWithData = (parentProps: Props) => {
    return (column: TableColumn<ColumnKeys>, dataRow: TableDataRow): React.ReactNode =>
      this.renderBodyCell(parentProps, column, dataRow);
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({widths});
  };

  render() {
    const {
      isLoading: isParentLoading,
      eventView,
      tagKey,
      location,
      projects,
      organization,
    } = this.props;

    const aggregateColumn = getTransactionField(
      SpanOperationBreakdownFilter.None,
      projects,
      eventView
    );

    const newColumns = [...COLUMN_ORDER].map(c => {
      const newColumn = {...c};
      if (c.key === 'tagValue') {
        newColumn.name = tagKey;
      }
      return newColumn;
    });

    return (
      <SegmentExplorerQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        aggregateColumn={aggregateColumn}
        tagKey={tagKey}
        limit={10}
        order="-sumdelta"
        allTagKeys
      >
        {({isLoading, tableData}) => {
          return (
            <GridEditable
              isLoading={isLoading || isParentLoading}
              data={tableData && tableData.data ? tableData.data : []}
              columnOrder={newColumns}
              columnSortBy={[]}
              grid={{
                renderHeadCell: this.renderHeadCellWithMeta(
                  eventView,
                  {},
                  newColumns
                ) as any,
                renderBodyCell: this.renderBodyCellWithData(this.props) as any,
                onResizeColumn: this.handleResizeColumn as any,
              }}
              location={location}
            />
          );
        }}
      </SegmentExplorerQuery>
    );
  }
}
const LinkContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  grid-gap: ${space(1)};
  width: 100px;
`;

export default TagValueTable;
