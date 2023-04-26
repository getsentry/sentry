import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Alignments} from 'sentry/components/gridEditable/sortLink';
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
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {TableColumn} from 'sentry/views/discover/table/types';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

type Props = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  spike: FailureSpike;
  transactions: string[] | undefined;
};

export default function IssueTable({organization, location, spike, transactions}: Props) {
  const COLUMN_ORDER = [
    {
      key: 'issue',
      name: 'Issue',
      width: 120,
    },
    {
      key: 'title',
      name: 'Title',
      width: 280,
    },
    {
      key: 'count()',
      name: 'Count',
      width: 50,
    },
    {
      key: 'count_unique(user)',
      name: 'Users',
      width: 50,
    },
  ];

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

    return rendered;
  }

  let searchQuery = 'event.type:error transaction:[';
  transactions?.forEach(transaction => (searchQuery += `${transaction},`));
  searchQuery = searchQuery.slice(0, searchQuery.length - 1) + ']';

  const {query} = location;
  const hasStartAndEnd = spike?.startTimestamp && spike.endTimestamp;
  // const aggregateAlias = getAggregateAlias(
  //   `count_if(transaction, equals, ${transactionName})`
  // );
  const newQuery: NewQuery = {
    name: t('Failure Detail Issues'),
    projects: [],
    start: spike?.startTimestamp,
    end: spike?.endTimestamp,
    range: !hasStartAndEnd
      ? decodeScalar(query.statsPeriod) || DEFAULT_STATS_PERIOD
      : undefined,
    fields: ['issue', 'title', 'count()', 'count_unique(user)'],
    query: searchQuery,
    orderby: `-${getAggregateAlias('count()')}`,
    version: 2,
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  if (!transactions) {
    return (
      <GridEditable
        isLoading
        data={[]}
        columnOrder={COLUMN_ORDER}
        columnSortBy={eventView.getSorts()}
        grid={{}}
        location={location}
      />
    );
  }

  return (
    <DiscoverQuery
      eventView={eventView}
      orgSlug={organization.slug}
      location={location}
      referrer="api.starfish.failure-issue-list"
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
  );
}

const StyledNonLink = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
