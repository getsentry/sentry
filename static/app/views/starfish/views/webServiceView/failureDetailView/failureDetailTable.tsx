import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {NewQuery, Organization} from 'sentry/types';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {decodeScalar} from 'sentry/utils/queryString';
import {TableColumn} from 'sentry/views/discover/table/types';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

type Props = {
  location: Location;
  organization: Organization;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'transaction',
    width: 600,
  },
  {
    key: 'count_if(http.status_code,greaterOrEquals,500)',
    name: 'failure_count()',
    width: 300,
  },
  {
    key: 'equation|count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500))',
    name: 'failure_rate()',
  },
];

export default function EndpointTable({organization, location}: Props) {
  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    const align = column.name === 'transaction' ? 'left' : 'right';
    return <StyledNonLink align={align}>{column.name}</StyledNonLink>;
  }

  function renderBodyCell(
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow,
    _onSelect?: (row: EndpointDataRow) => void
  ): React.ReactNode {
    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableData.meta, false);
    const rendered = fieldRenderer(dataRow, {organization, location});

    if (column.key === 'transaction') {
      let prefix = '';
      if (dataRow['http.method']) {
        prefix = `${dataRow['http.method']} `;
      }
      return (
        <Link
          to={{
            pathname: `/starfish/failure-detail/${
              dataRow['http.method']
            }:${encodeURIComponent(dataRow.transaction)}`,
            query: {start: location.query.start, end: location.query.end},
          }}
        >
          {prefix}
          {dataRow.transaction}
        </Link>
      );
    }

    return rendered;
  }

  const {query} = location;
  const hasStartAndEnd = query.start && query.end;
  const newQuery: NewQuery = {
    name: t('Failure Sample'),
    projects: [],
    start: decodeScalar(query.start),
    end: decodeScalar(query.end),
    range: !hasStartAndEnd
      ? decodeScalar(query.statsPeriod) || DEFAULT_STATS_PERIOD
      : undefined,
    fields: [
      'transaction',
      'count_if(http.status_code,greaterOrEquals,500)',
      'equation|count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500))',
      'http.method',
      'count_if(http.status_code,equals,200)',
    ],
    query:
      'event.type:transaction has:http.method transaction.op:http.server count_if(http.status_code,greaterOrEquals,500):>0',
    version: 2,
  };

  newQuery.orderby = '-count_if_http_status_code_greaterOrEquals_500';

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  return (
    <div>
      <DiscoverQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        referrer="api.starfish.failure-event-list"
        queryExtras={{dataset: 'discover'}}
        limit={5}
      >
        {({pageLinks, isLoading, tableData}) => (
          <Fragment>
            <GridEditable
              isLoading={isLoading}
              data={tableData ? tableData.data : []}
              columnOrder={COLUMN_ORDER}
              columnSortBy={eventView.getSorts()}
              grid={{
                renderHeadCell,
                renderBodyCell: (column: GridColumnHeader, dataRow: TableDataRow) =>
                  renderBodyCell(
                    tableData,
                    column as TableColumn<keyof TableDataRow>,
                    dataRow
                  ) as any,
              }}
              location={location}
            />

            <Pagination pageLinks={pageLinks} />
          </Fragment>
        )}
      </DiscoverQuery>
    </div>
  );
}

const StyledNonLink = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
