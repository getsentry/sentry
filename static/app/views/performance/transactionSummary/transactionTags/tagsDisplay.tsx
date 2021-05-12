import React, {Component} from 'react';
import {browserHistory} from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import HeatMapChart from 'app/components/charts/heatMapChart';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import GridEditable, {GridColumnOrder} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconAdd} from 'app/icons/iconAdd';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Series} from 'app/types/echarts';
import {axisDuration, axisLabelFormatter} from 'app/utils/discover/charts';
import EventView, {isFieldSortable} from 'app/utils/discover/eventView';
import {formatPercentage} from 'app/utils/formatters';
import SegmentExplorerQuery, {
  TableData,
  TableDataRow,
} from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
import TagKeyHistogramQuery, {
  TableData as TagTableData,
} from 'app/utils/performance/segmentExplorer/tagKeyHistogramQuery';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import CellAction, {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {PerformanceDuration} from '../../utils';
import {SpanOperationBreakdownFilter} from '../filter';
import {getTransactionField, TagValue} from '../tagExplorer';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  tagKey: string;
};

const TAGS_CURSOR_NAME = 'tags_cursor';

const DisplayWrapper = (props: Props) => {
  const {eventView, location, organization, projects, tagKey} = props;
  const aggregateColumn = getTransactionField(
    SpanOperationBreakdownFilter.None,
    projects,
    eventView
  );
  if (!tagKey) {
    return null;
  }
  return (
    <TagKeyHistogramQuery
      eventView={eventView}
      orgSlug={organization.slug}
      location={location}
      aggregateColumn={aggregateColumn}
      limit={20}
      tagKey={tagKey}
      order="-sumdelta"
    >
      {({isLoading, tableData}) => {
        return <TagsDisplay {...props} tableData={tableData} isLoading={isLoading} />;
      }}
    </TagKeyHistogramQuery>
  );
};

const findRowKey = row => {
  return Object.keys(row).find(key => key.includes('histogram'));
};

const _TagsDisplay = (
  props: Props & {
    theme: Theme;
    tableData: TagTableData | null;
    isLoading: boolean;
  }
) => {
  const {tableData, isLoading} = props;

  if (!tableData || !tableData.data) {
    return null;
  }

  // TODO(k-fish): Replace with actual theme colors.
  const purples = ['#D1BAFC', '#9282F3', '#6056BA', '#313087', '#021156'];

  const rowKey = findRowKey(tableData.data[0]);
  if (!rowKey) {
    return null;
  }

  const columnNames = new Set();
  const xValues = new Set();
  let maxCount = 0;

  const _data = tableData.data.map(row => {
    const x = axisDuration(row[rowKey] as number);
    const y = row.tags_value;
    columnNames.add(y);
    xValues.add(x);

    maxCount = Math.max(maxCount, row.count);

    return [x, y, row.count] as number[];
  });

  _data.sort((a, b) => {
    if (a[0] === b[0]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  // TODO(k-fish): Cleanup options
  const chartOptions = {
    height: 290,
    animation: false,
    colors: purples,
    tooltip: {},
    yAxis: {
      type: 'category' as const,
      data: Array.from(columnNames),
      splitArea: {
        show: true,
      },
    } as any, // TODO(k-fish): Expand typing to allow data option
    xAxis: {
      boundaryGap: true,
      type: 'category' as const,
      splitArea: {
        show: true,
      },
      data: Array.from(xValues),
      axisLabel: {
        show: true,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (value: number) => axisLabelFormatter(value, 'Count'),
      },
      axisLine: {},
      axisPointer: {
        show: false,
      },
      axisTick: {
        show: true,
        interval: 0,
        alignWithLabel: true,
      },
    } as any, // TODO(k-fish): Expand typing to allow data option
    visualMap: {
      min: 0,
      max: maxCount,
      show: false,
      orient: 'horizontal',
      calculable: true,
      inRange: {
        color: purples,
      },
    },

    grid: {
      left: space(3),
      right: space(3),
      top: space(3),
      bottom: space(4),
    },
  };

  const series: Series[] = [];

  series.push({
    seriesName: 'Count',
    dataArray: _data,
    label: {
      show: true,
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
      },
    },
  } as any); // TODO(k-fish): Fix heatmap data typing

  const reloading = isLoading;
  const loading = isLoading;

  return (
    <div {...props}>
      <StyledPanel>
        <StyledHeaderTitleLegend>
          {t('Heat Map')}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(
              'This heatmap shows the frequency for each duration across the most common tag values'
            )}
          />
        </StyledHeaderTitleLegend>

        <TransitionChart loading={loading} reloading={reloading}>
          <TransparentLoadingMask visible={reloading} />

          <HeatMapChart series={series} {...chartOptions} />
        </TransitionChart>
      </StyledPanel>
      <TagValueTable {...props} />
    </div>
  );
};

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

type TableProps = {
  isLoading?: boolean;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  tagKey: string;
  eventView: EventView;
};
class TagValueTable extends Component<TableProps> {
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
              }}
              location={location}
            />
          );
        }}
      </SegmentExplorerQuery>
    );
  }
}

const StyledPanel = styled(Panel)`
  padding: ${space(3)};
  margin-bottom: 0;
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
`;
const StyledHeaderTitleLegend = styled(HeaderTitleLegend)``;
const LinkContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  grid-gap: ${space(1)};
  width: 100px;
`;

const TagsDisplay = withTheme(_TagsDisplay);

export default DisplayWrapper;
