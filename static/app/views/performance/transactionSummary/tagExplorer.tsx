import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import GridEditable from 'app/components/gridEditable';
import Link from 'app/components/links/link';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {formatPercentage} from 'app/utils/formatters';
import SegmentExplorerQuery, {
  TableDataRow,
  TagHint,
  TopValue,
} from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {
  PerformanceDuration,
  platformToPerformanceType,
  PROJECT_PERFORMANCE_TYPE,
} from '../utils';

import {SpanOperationBreakdownFilter} from './filter';

const TAGS_CURSOR_NAME = 'tags_cursor';

const COLUMN_ORDER = [
  {
    key: 'key',
    name: 'Key',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'tagValue',
    name: 'Tag Values',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'aggregate',
    name: 'Avg Duration',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'frequency',
    name: 'Frequency',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'comparison',
    name: 'Comparison To Avg',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'totalTimeLost',
    name: 'Total Time Lost',
    width: -1,
    column: {
      kind: 'field',
    },
  },
];

const filterToField = {
  [SpanOperationBreakdownFilter.Browser]: 'span_op_breakdowns[ops.browser]',
  [SpanOperationBreakdownFilter.Http]: 'span_op_breakdowns[ops.db]',
  [SpanOperationBreakdownFilter.Db]: 'span_op_breakdowns[ops.http]',
  [SpanOperationBreakdownFilter.Resource]: 'span_op_breakdowns[ops.resource]',
};

const getTransactionField = (
  currentFilter: SpanOperationBreakdownFilter,
  projects: Project[],
  projectIds: readonly number[]
) => {
  const fieldFromFilter = filterToField[currentFilter];
  if (fieldFromFilter) {
    return fieldFromFilter;
  }

  const performanceType = platformToPerformanceType(projects, projectIds);
  if (performanceType === PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    return 'measurements[lcp]';
  }

  return 'duration';
};

const getColumnsWithReplacedDuration = (
  currentFilter: SpanOperationBreakdownFilter,
  projects: Project[],
  projectIds: readonly number[]
) => {
  const columns = COLUMN_ORDER.map(c => ({...c}));
  const durationColumn = columns.find(c => c.key === 'aggregate');

  if (!durationColumn) {
    return columns;
  }

  const fieldFromFilter = filterToField[currentFilter];
  if (fieldFromFilter) {
    durationColumn.name = 'Avg Span Duration';
  }

  const performanceType = platformToPerformanceType(projects, projectIds);
  if (performanceType === PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    durationColumn.name = 'Avg LCP';
  }

  return columns;
};

const handleTagValueClick = (location: Location, tagKey: string, tagValue: string) => {
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

const renderBodyCell = (
  parentProps: Props,
  column: TableColumn<keyof TableDataRow>,
  dataRow: TableDataRow
): React.ReactNode => {
  const value = dataRow[column.key];
  const {location} = parentProps;

  if (column.key === 'tagValue') {
    const localValue = dataRow.tagValue;
    return (
      <Link
        to=""
        onClick={() => handleTagValueClick(location, dataRow.key, localValue.value)}
      >
        <TagValue value={localValue} />
      </Link>
    );
  }

  if (column.key === 'frequency') {
    const localValue = dataRow.frequency;
    return formatPercentage(localValue, 0);
  }

  if (column.key === 'comparison') {
    const localValue = dataRow.comparison;

    let text = '';
    if (localValue > 1) {
      const pct = formatPercentage(localValue - 1, 0);
      text = `+${pct} slower`;
    } else {
      const pct = formatPercentage(localValue - 1, 0);
      text = `${pct} faster`;
    }

    return t(text);
  }
  if (column.key === 'aggregate') {
    return <PerformanceDuration abbreviation milliseconds={dataRow.aggregate} />;
  }

  if (column.key === 'totalTimeLost') {
    return <PerformanceDuration abbreviation milliseconds={dataRow.totalTimeLost} />;
  }
  return value;
};

const renderBodyCellWithData = (parentProps: Props) => {
  return (
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode => renderBodyCell(parentProps, column, dataRow);
};

type TagValueProps = {
  value: TopValue | TagHint;
};

function TagValue(props: TagValueProps) {
  const {value} = props;
  return <div>{value.name}</div>;
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
  aggregateColumn: string;
};

class _TagExplorer extends React.Component<Props, State> {
  setAggregateColumn(value: string) {
    this.setState({
      aggregateColumn: value,
    });
  }

  render() {
    const {eventView, organization, location, currentFilter, projects} = this.props;
    const aggregateColumn = getTransactionField(
      currentFilter,
      projects,
      eventView.project
    );
    const columns = getColumnsWithReplacedDuration(
      currentFilter,
      projects,
      eventView.project
    );

    const cursor = decodeScalar(location.query?.[TAGS_CURSOR_NAME]);

    return (
      <SegmentExplorerQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        aggregateColumn={aggregateColumn}
        limit={5}
        cursor={cursor}
      >
        {({isLoading, tableData, pageLinks}) => {
          return (
            <React.Fragment>
              <TagsHeader pageLinks={pageLinks} />
              <GridEditable
                isLoading={isLoading}
                data={tableData ? tableData : []}
                columnOrder={columns}
                columnSortBy={[]}
                grid={{
                  renderBodyCell: renderBodyCellWithData(this.props) as any,
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
  pageLinks: string | null;
};
function TagsHeader(props: HeaderProps) {
  const {pageLinks} = props;
  const handleCursor = (cursor: string, pathname: string, query: Query) => {
    browserHistory.push({
      pathname,
      query: {...query, [TAGS_CURSOR_NAME]: cursor},
    });
  };

  return (
    <Header>
      <SectionHeading>{t('Suspect Tags')}</SectionHeading>
      <StyledPagination pageLinks={pageLinks} onCursor={handleCursor} size="small" />
    </Header>
  );
}

export const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  line-height: 1.3;
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
