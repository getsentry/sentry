import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import GridEditable from 'app/components/gridEditable';
import Link from 'app/components/links/link';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import SegmentExplorerQuery, {
  TableDataRow,
  TopValue,
} from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import CellAction from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {PerformanceDuration} from '../utils';

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
    key: 'topValues',
    name: 'Values',
    width: -1,
    column: {
      kind: 'field',
    },
  },
];

const HEADER_OPTIONS: DropdownOption[] = [
  {
    label: 'Slowest Tag Values',
    value: '-aggregate',
  },
  {
    label: 'Fastest Tag Values',
    value: 'aggregate',
  },
  {
    label: 'Most Frequent Tag Values',
    value: '-count',
  },
];

const DURATION_OPTIONS: DropdownOption[] = [
  {
    label: 'transaction.duration',
    value: 'duration',
  },
  {
    label: 'measurements.lcp',
    value: 'measurements[lcp]',
  },
];

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

  if (Array.isArray(value)) {
    return (
      // TODO(Kevan): Remove ts any
      <TagValueContainer>
        {value.map(v => {
          return (
            <TagInner key={v.value}>
              <Link
                to=""
                onClick={() => handleTagValueClick(location, dataRow.key, v.value)}
              >
                <TagValue value={v} />
              </Link>
              <DurationCountSplit>
                <PerformanceDuration milliseconds={v.aggregate} />
                <div>{formatAbbreviatedNumber(v.count)}</div>
              </DurationCountSplit>
            </TagInner>
          );
        })}
      </TagValueContainer>
    );
  }
  return value;
};

const renderBodyCellWithData = (parentProps: Props) => {
  return (
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode => renderBodyCell(parentProps, column, dataRow);
};

const TagValueContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: ${space(1)};
`;
const TagInner = styled('div')`
  display: grid;
`;
const DurationCountSplit = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

type TagValueProps = {
  value: TopValue;
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
};

type State = {
  tagOrder: string;
  aggregateColumn: string;
};

class _TagExplorer extends React.Component<Props, State> {
  state: State = {
    tagOrder: HEADER_OPTIONS[0].value,
    aggregateColumn: DURATION_OPTIONS[0].value,
  };

  setTagOrder(value: string) {
    this.setState({
      tagOrder: value,
    });
  }

  setAggregateColumn(value: string) {
    this.setState({
      aggregateColumn: value,
    });
  }

  render() {
    const {eventView, organization, location} = this.props;
    const {tagOrder, aggregateColumn} = this.state;
    const handleCursor = () => {};

    const sortDropdownOptions = HEADER_OPTIONS;
    const columnDropdownOptions = DURATION_OPTIONS;

    const selectedSort =
      sortDropdownOptions.find(o => o.value === tagOrder) || sortDropdownOptions[0];
    const selectedColumn =
      columnDropdownOptions.find(o => o.value === aggregateColumn) ||
      columnDropdownOptions[0];

    return (
      <SegmentExplorerQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        tagOrder={tagOrder}
        aggregateColumn={aggregateColumn}
        limit={5}
      >
        {({isLoading, tableData, pageLinks}) => {
          return (
            <React.Fragment>
              <TagsHeader
                selectedSort={selectedSort}
                sortOptions={sortDropdownOptions}
                selectedColumn={selectedColumn}
                columnOptions={columnDropdownOptions}
                handleSortDropdownChange={(v: string) => this.setTagOrder(v)}
                handleColumnDropdownChange={(v: string) => this.setAggregateColumn(v)}
              />
              <GridEditable
                isLoading={isLoading}
                data={tableData ? tableData : []}
                columnOrder={COLUMN_ORDER}
                columnSortBy={[]}
                grid={{
                  renderBodyCell: renderBodyCellWithData(this.props) as any,
                }}
                location={location}
              />
              <StyledPagination
                pageLinks={pageLinks}
                onCursor={handleCursor}
                size="small"
              />
            </React.Fragment>
          );
        }}
      </SegmentExplorerQuery>
    );
  }
}

type DropdownOption = {
  label: string;
  value: string;
};

type HeaderProps = {
  selectedSort: DropdownOption;
  sortOptions: DropdownOption[];
  selectedColumn: DropdownOption;
  columnOptions: DropdownOption[];
  handleSortDropdownChange: (k: string) => void;
  handleColumnDropdownChange: (k: string) => void;
};
function TagsHeader(props: HeaderProps) {
  const {
    selectedSort,
    sortOptions,
    selectedColumn,
    columnOptions,
    handleSortDropdownChange,
    handleColumnDropdownChange,
  } = props;
  return (
    <Header>
      <DropdownControl
        data-test-id="sort-tag-values"
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton
            {...getActorProps()}
            isOpen={isOpen}
            prefix={t('Sort')}
            size="small"
          >
            {selectedSort.label}
          </StyledDropdownButton>
        )}
      >
        {sortOptions.map(({value, label}) => (
          <DropdownItem
            data-test-id={`option-${value}`}
            key={value}
            onSelect={handleSortDropdownChange}
            eventKey={value}
            isActive={value === selectedSort.value}
          >
            {label}
          </DropdownItem>
        ))}
      </DropdownControl>
      <DropdownControl
        data-test-id="tag-column-performance"
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton
            {...getActorProps()}
            isOpen={isOpen}
            prefix={t('Column')}
            size="small"
          >
            {selectedColumn.label}
          </StyledDropdownButton>
        )}
      >
        {columnOptions.map(({value, label}) => (
          <DropdownItem
            data-test-id={`option-${value}`}
            key={value}
            onSelect={handleColumnDropdownChange}
            eventKey={value}
            isActive={value === selectedColumn.value}
          >
            {label}
          </DropdownItem>
        ))}
      </DropdownControl>
    </Header>
  );
}

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 ${space(1)} 0;
`;
const StyledDropdownButton = styled(DropdownButton)`
  min-width: 145px;
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 ${space(3)} 0;
`;

export const TagExplorer = _TagExplorer;
