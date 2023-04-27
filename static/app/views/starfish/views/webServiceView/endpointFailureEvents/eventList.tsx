import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery, Organization} from 'sentry/types';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {TableColumn} from 'sentry/views/discover/table/types';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

type Props = {
  httpOp: string;
  location: Location;
  organization: Organization;
  transactionName: string;
};

const COLUMN_ORDER = [
  {
    key: 'id',
    name: 'Event ID',
    width: 300,
  },
  {
    key: 'http.status_code',
    name: 'HTTP Status Code',
    width: 300,
  },
  {
    key: 'timestamp',
    name: 'Timestamp',
  },
];

export default function EventList({
  organization,
  location,
  httpOp,
  transactionName,
}: Props) {
  function renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumn<keyof TableDataRow>
  ): React.ReactNode {
    const align = fieldAlignment(column.name, column.type, tableMeta);
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

    if (column.key === 'id') {
      return (
        <Link to={`/performance/${dataRow.project}:${dataRow.id}`}>
          {dataRow.id.slice(0, 8)}
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
    fields: ['id', 'http.status_code', 'timestamp', 'project'],
    query: `transaction:${transactionName} http.method:${httpOp} http.status_code:[500,502,503,504,521]`,
    orderby: '-timestamp',
    version: 2,
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  return (
    <div>
      <Title>{t('Sample Events')}</Title>
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
                renderHeadCell: (column: GridColumnHeader) =>
                  renderHeadCell(
                    tableData?.meta,
                    column as TableColumn<keyof TableDataRow>
                  ),
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

const Title = styled('h5')`
  margin-bottom: ${space(1)};
`;
