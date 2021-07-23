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
import EventView from 'app/utils/discover/eventView';
import {fieldAlignment} from 'app/utils/discover/fields';
import {formatPercentage} from 'app/utils/formatters';
import {
  TableData,
  TableDataRow,
} from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {PerformanceDuration} from '../../utils';
import {TagValue} from '../tagExplorer';

import {trackTagPageInteraction} from './utils';

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
  location: Location;
  organization: Organization;
  aggregateColumn: string;
  projects: Project[];
  transactionName: string;
  tagKey: string;
  eventView: EventView;
  tableData: TableData | null;
  isLoading: boolean;
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

    const currentSortKind = currentSort ? currentSort.kind : undefined;

    return (
      <SortLink
        align={align}
        title={columnInfo.name}
        direction={currentSortKind}
        canSort={false}
        generateSortLink={generateSortLink}
        onClick={() => {}} // TODO(k-fish): Implement sorting
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
      trackTagPageInteraction(organization);

      const searchConditions = tokenizeSearch(eventView.query);

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

  renderBodyCell = (
    parentProps: Props,
    column: TableColumn<ColumnKeys>,
    dataRow: TableDataRow
  ): React.ReactNode => {
    const value = dataRow[column.key];
    const {location, eventView, organization} = parentProps;

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
          <TagValue row={dataRow} />
        </CellAction>
      );
    }

    if (column.key === 'frequency') {
      return <AlignRight>{formatPercentage(dataRow.frequency, 0)}</AlignRight>;
    }

    if (column.key === 'action') {
      const searchConditions = tokenizeSearch(eventView.query);
      const disabled = searchConditions.hasTag(dataRow.tags_key);
      return (
        <Link
          disabled={disabled}
          to=""
          onClick={() => {
            trackTagPageInteraction(organization);
            this.handleTagValueClick(location, dataRow.tags_key, dataRow.tags_value);
          }}
        >
          <LinkContainer>
            <IconAdd isCircled />
            {t('Add to filter')}
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

    if (column.key === 'count') {
      return <AlignRight>{value}</AlignRight>;
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
    const {eventView, tagKey, location, isLoading, tableData, aggregateColumn} =
      this.props;

    const newColumns = [...COLUMN_ORDER].map(c => {
      const newColumn = {...c};
      if (c.key === 'tagValue') {
        newColumn.name = tagKey;
      }
      if (c.key === 'aggregate') {
        if (aggregateColumn === 'measurements.lcp') {
          newColumn.name = 'Avg LCP';
        }
      }
      return newColumn;
    });

    return (
      <StyledPanelTable>
        <GridEditable
          isLoading={isLoading}
          data={tableData && tableData.data ? tableData.data : []}
          columnOrder={newColumns}
          columnSortBy={[]}
          grid={{
            renderHeadCell: this.renderHeadCellWithMeta(
              eventView,
              tableData ? tableData.meta : {},
              newColumns
            ) as any,
            renderBodyCell: this.renderBodyCellWithData(this.props) as any,
            onResizeColumn: this.handleResizeColumn as any,
          }}
          location={location}
        />
      </StyledPanelTable>
    );
  }
}

const StyledPanelTable = styled('div')`
  > div {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
`;

const AlignRight = styled('div')`
  text-align: right;
`;

const LinkContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(0.5)};
  justify-content: flex-end;
  align-items: center;
`;

export default TagValueTable;
