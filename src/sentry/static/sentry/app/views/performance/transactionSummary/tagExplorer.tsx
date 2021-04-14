import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor} from 'history';

import {TagSegment} from 'app/actionCreators/events';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import GridEditable from 'app/components/gridEditable';
import Link from 'app/components/links/link';
import Pagination from 'app/components/pagination';
import Tooltip from 'app/components/tooltip';
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
    key: 'tagValue',
    name: 'Tag Values',
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
    name: 'Comparison',
    width: -1,
    column: {
      kind: 'field',
    },
  },
  {
    key: 'otherValues',
    name: 'Facet Map',
    width: -1,
    column: {
      kind: 'field',
    },
  },
];

const HEADER_OPTIONS: DropdownOption[] = [
  {
    label: 'Suspect Tag Values',
    value: '-sumdelta',
  },
  {
    label: 'Slowest Tag Values',
    value: '-aggregate',
  },
  {
    label: 'Fastest Tag Values',
    value: 'aggregate',
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

    return (
      <Tooltip title={PerformanceDuration({milliseconds: dataRow.aggregate})}>
        {t(text)}
      </Tooltip>
    );
  }

  if (column.key === 'otherValues' && Array.isArray(value)) {
    const converted = dataRow.otherValues;
    const segments = converted.map(val => {
      return {
        count: val.count,
        name: val.name,
        key: dataRow.key,
        value: val.value,
        isOther: val.isOther,
        url: '',
      };
    });

    return <SegmentVisualization location={location} segments={segments} />;
  }
  return value;
};

type SegmentValue = {
  to: LocationDescriptor;
  onClick: () => void;
  index: number;
};
type SegmentProps = {
  location: Location;
  segments: TagSegment[];
};
const SegmentVisualization = (props: SegmentProps) => {
  const {location, segments} = props;
  return (
    <SegmentBar>
      {segments.map((value, index) => {
        const pct = value.count * 100;
        const pctLabel = Math.floor(pct);
        const renderTooltipValue = () => {
          return value.name || t('n/a');
        };

        const tooltipHtml = (
          <React.Fragment>
            <div className="truncate">{renderTooltipValue()}</div>
            {pctLabel}%
          </React.Fragment>
        );

        const segmentProps: SegmentValue = {
          index,
          to: value.url,
          onClick: () => handleTagValueClick(location, value.key ?? '', value.value),
        };

        return (
          <div key={value.value} style={{width: pct + '%'}}>
            <Tooltip title={tooltipHtml} containerDisplayMode="block">
              {value.isOther ? <OtherSegment /> : <Segment {...segmentProps} />}
            </Tooltip>
          </div>
        );
      })}
    </SegmentBar>
  );
};

const SegmentBar = styled('div')`
  display: flex;
  overflow: hidden;
  border-radius: 2px;
`;

const COLORS = [
  '#3A3387',
  '#5F40A3',
  '#8C4FBD',
  '#B961D3',
  '#DE76E4',
  '#EF91E8',
  '#F7B2EC',
  '#FCD8F4',
  '#FEEBF9',
];

const OtherSegment = styled('span')`
  display: block;
  width: 100%;
  height: 16px;
  color: inherit;
  outline: none;
  background-color: ${COLORS[COLORS.length - 1]};
`;

const Segment = styled(Link)<SegmentValue>`
  display: block;
  width: 100%;
  height: 16px;
  color: inherit;
  outline: none;
  background-color: ${p => COLORS[p.index]};
`;

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
