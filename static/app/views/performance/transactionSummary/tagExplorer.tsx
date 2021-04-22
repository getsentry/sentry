import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

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

const DURATION_OPTIONS: DropdownOption[] = [
  {
    label: 'transaction.duration',
    value: 'duration',
  },
  {
    label: 'measurements.lcp',
    value: 'measurements[lcp]',
  },
  {
    label: 'spans.browser',
    value: 'span_op_breakdowns[ops.browser]',
  },
  {
    label: 'spans.db',
    value: 'span_op_breakdowns[ops.db]',
  },
  {
    label: 'spans.http',
    value: 'span_op_breakdowns[ops.http]',
  },
  {
    label: 'spans.resource',
    value: 'span_op_breakdowns[ops.resource]',
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
};

type State = {
  aggregateColumn: string;
};

class _TagExplorer extends React.Component<Props, State> {
  state: State = {
    aggregateColumn: DURATION_OPTIONS[0].value,
  };

  setAggregateColumn(value: string) {
    this.setState({
      aggregateColumn: value,
    });
  }

  render() {
    const {eventView, organization, location} = this.props;
    const {aggregateColumn} = this.state;
    const handleCursor = () => {};

    const columnDropdownOptions = DURATION_OPTIONS;
    const selectedColumn =
      columnDropdownOptions.find(o => o.value === aggregateColumn) ||
      columnDropdownOptions[0];

    return (
      <SegmentExplorerQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        aggregateColumn={aggregateColumn}
        limit={5}
      >
        {({isLoading, tableData, pageLinks}) => {
          return (
            <React.Fragment>
              <TagsHeader
                selectedColumn={selectedColumn}
                columnOptions={columnDropdownOptions}
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
  selectedColumn: DropdownOption;
  columnOptions: DropdownOption[];
  handleColumnDropdownChange: (k: string) => void;
};
function TagsHeader(props: HeaderProps) {
  const {selectedColumn, columnOptions, handleColumnDropdownChange} = props;
  return (
    <Header>
      <SectionHeading>{t('Suspect Tags')}</SectionHeading>
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
