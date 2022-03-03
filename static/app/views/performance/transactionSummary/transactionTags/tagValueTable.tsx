import {Component} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {formatPercentage} from 'sentry/utils/formatters';
import {
  TableData,
  TableDataRow,
} from 'sentry/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'sentry/views/eventsV2/table/cellAction';
import {TableColumn} from 'sentry/views/eventsV2/table/types';

import {TagValue} from '../transactionOverview/tagExplorer';
import {normalizeSearchConditions} from '../utils';

import {
  TAGS_TABLE_COLUMN_ORDER,
  TagsTableColumn,
  TagsTableColumnKeys,
} from './tagsDisplay';
import {trackTagPageInteraction} from './utils';

const TAGS_CURSOR_NAME = 'tags_cursor';

type Props = {
  aggregateColumn: string;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  pageLinks: string | null;
  projects: Project[];
  tableData: TableData | null;
  transactionName: string;
  onCursor?: CursorHandler;
  tagKey?: string;
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
    column: TableColumn<TagsTableColumnKeys>,
    columnInfo: TagsTableColumn
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
        canSort
        generateSortLink={generateSortLink}
      />
    );
  }

  renderHeadCellWithMeta = (
    sortedEventView: EventView,
    tableMeta: TableData['meta'],
    columns: TagsTableColumn[]
  ) => {
    return (column: TableColumn<TagsTableColumnKeys>, index: number): React.ReactNode =>
      this.renderHeadCell(sortedEventView, tableMeta, column, columns[index]);
  };

  handleTagValueClick = (location: Location, tagKey: string, tagValue: string) => {
    const queryString = decodeScalar(location.query.query);
    const conditions = new MutableSearch(queryString ?? '');

    conditions.addFilterValues(tagKey, [tagValue]);

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
    column: TableColumn<TagsTableColumnKeys>,
    tagValue: React.ReactText,
    actionRow: any
  ) => {
    return (action: Actions) => {
      const {eventView, location, organization} = this.props;
      trackTagPageInteraction(organization);

      const searchConditions = normalizeSearchConditions(eventView.query);

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

  generateReleaseLocation = (release: string) => {
    const {organization, location} = this.props;
    const {project} = location.query;

    return {
      pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(
        release
      )}`,
      query: {project},
    };
  };

  renderBodyCell = (
    parentProps: Props,
    column: TableColumn<TagsTableColumnKeys>,
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
          {column.name === 'release' ? (
            <Link to={this.generateReleaseLocation(dataRow.tags_value)}>
              <TagValue row={dataRow} />
            </Link>
          ) : (
            <TagValue row={dataRow} />
          )}
        </CellAction>
      );
    }

    if (column.key === 'frequency') {
      return <AlignRight>{formatPercentage(dataRow.frequency, 0)}</AlignRight>;
    }

    if (column.key === 'action') {
      const searchConditions = new MutableSearch(eventView.query);
      const disabled = searchConditions.hasFilter(dataRow.tags_key);
      return (
        <AlignRight>
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
        </AlignRight>
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
    return (
      column: TableColumn<TagsTableColumnKeys>,
      dataRow: TableDataRow
    ): React.ReactNode => this.renderBodyCell(parentProps, column, dataRow);
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
      eventView,
      tagKey,
      location,
      isLoading,
      tableData,
      aggregateColumn,
      pageLinks,
      onCursor,
    } = this.props;

    const newColumns = [...TAGS_TABLE_COLUMN_ORDER].map(c => {
      const newColumn = {...c};
      if (c.key === 'tagValue' && tagKey) {
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
            onResizeColumn: this.handleResizeColumn,
          }}
          location={location}
        />

        <Pagination pageLinks={pageLinks} onCursor={onCursor} size="small" />
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
  flex: 1;
`;

const LinkContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  justify-content: flex-end;
  align-items: center;
`;

export default TagValueTable;
