import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';
import {TableColumn} from 'sentry/views/discover/table/types';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';
import {PercentChangeCell} from 'sentry/views/starfish/views/webServiceView/endpointList';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

type Props = {
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  spike: FailureSpike;
  tableData: TableData | null;
  pageLinks?: string | null | undefined;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: t('Endpoint'),
    width: 450,
  },
  {
    key: 'http_error_count()',
    name: t('5XX Responses'),
    width: 150,
  },
  {
    key: 'http_error_count_percent_change()',
    name: t('Change'),
    width: 80,
  },
];

export default function FailureDetailTable({
  location,
  organization,
  eventView,
  isLoading,
  tableData,
  pageLinks,
  spike,
}: Props) {
  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (column.key === 'transaction') {
      return <StyledNonLink align="left">{column.name}</StyledNonLink>;
    }
    return <StyledNonLink align="right">{column.name}</StyledNonLink>;
  }

  function renderBodyCell(
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

    if (field === 'transaction') {
      const prefix = dataRow['http.method'] ? `${dataRow['http.method']} ` : '';
      const queryParams = {
        start: spike ? new Date(spike.startTimestamp) : undefined,
        end: spike ? new Date(spike.endTimestamp) : undefined,
        method: dataRow['http.method'],
        endpoint: dataRow.transaction,
      };
      return (
        <Link to={`/starfish/endpoint-overview/?${qs.stringify(queryParams)}`}>
          {prefix}&nbsp;{dataRow.transaction}
        </Link>
      );
    }

    if (field === 'http_error_count_percent_change()') {
      const deltaValue = dataRow[field] as number;
      const trendDirection = deltaValue < 0 ? 'good' : deltaValue > 0 ? 'bad' : 'neutral';

      return (
        <NumberContainer>
          <PercentChangeCell trendDirection={trendDirection}>
            {tct('[sign][delta]', {
              sign: deltaValue >= 0 ? '+' : '-',
              delta: formatPercentage(Math.abs(deltaValue), 2),
            })}
          </PercentChangeCell>
        </NumberContainer>
      );
    }

    return rendered;
  }

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={tableData ? tableData.data : []}
        columnOrder={COLUMN_ORDER}
        columnSortBy={eventView.getSorts()}
        grid={{
          renderHeadCell,
          renderBodyCell: (column: GridColumnHeader, dataRow: TableDataRow) =>
            renderBodyCell(column as TableColumn<keyof TableDataRow>, dataRow) as any,
        }}
        location={location}
      />

      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

const StyledNonLink = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
