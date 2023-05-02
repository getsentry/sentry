import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import moment from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

import {getEndpointListQuery, getEndpointsTPMQuery} from './queries';

type Props = {
  filterOptions: {
    action: string;
    datetime: DateTimeObject;
    domain: string;
    transaction: string;
  };
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
  columns?: {
    key: string;
    name: string;
    width: number;
  }[];
};

export type DataRow = {
  count: number;
  description: string;
  domain: string;
  group_id: string;
};

const COLUMN_ORDER = [
  {
    key: 'description',
    name: 'URL',
    width: 600,
  },
  {
    key: 'tpm',
    name: 'tpm',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p50(exclusive_time)',
    name: 'p50',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'user_count',
    name: 'Users',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'transaction_count',
    name: 'Transactions',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'total_exclusive_time',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

export default function EndpointTable({
  location,
  onSelect,
  filterOptions,
  columns,
}: Props) {
  const {isLoading: areEndpointsLoading, data: endpointsData} = useQuery({
    queryKey: ['endpoints', filterOptions],
    queryFn: () =>
      fetch(`${HOST}/?query=${getEndpointListQuery(filterOptions)}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const {isLoading: isEndpointsTPMLoading, data: endpointsTPMData} = useQuery({
    queryKey: ['endpoints2', filterOptions],
    queryFn: () =>
      fetch(`${HOST}/?query=${getEndpointsTPMQuery(filterOptions)}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const tpmGroupedByURL = {};
  endpointsTPMData.forEach(({description, interval, count}) => {
    if (description in tpmGroupedByURL) {
      tpmGroupedByURL[description].push({name: interval, value: count});
    } else {
      tpmGroupedByURL[description] = [{name: interval, value: count}];
    }
  });

  const combinedEndpointData = endpointsData.map(data => {
    const url = data.description;

    const tpmSeries: Series = {
      seriesName: 'tpm',
      data: tpmGroupedByURL[url],
    };

    const zeroFilled = zeroFillSeries(tpmSeries, moment.duration(12, 'hours'));
    return {...data, tpm: zeroFilled};
  });

  return (
    <GridEditable
      isLoading={areEndpointsLoading || isEndpointsTPMLoading}
      data={combinedEndpointData}
      columnOrder={columns ?? COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: (column: GridColumnHeader, row: EndpointDataRow) =>
          renderBodyCell(column, row, onSelect),
      }}
      location={location}
    />
  );
}

export function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  // TODO: come up with a better way to identify number columns to align to the right
  if (
    column.key.toString().match(/^p\d\d/) ||
    !['description', 'transaction'].includes(column.key.toString())
  ) {
    return (
      <TextAlignLeft>
        <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
      </TextAlignLeft>
    );
  }
  return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
}

export function renderBodyCell(
  column: GridColumnHeader,
  row: EndpointDataRow,
  onSelect?: (row: EndpointDataRow) => void
): React.ReactNode {
  if (column.key === 'description' && onSelect) {
    return (
      <OverflowEllipsisTextContainer>
        <Link onClick={() => onSelect(row)} to="">
          {row[column.key]}
        </Link>
      </OverflowEllipsisTextContainer>
    );
  }

  if (column.key === 'tpm') {
    return <Sparkline color={CHART_PALETTE[3][1]} series={row[column.key]} />;
  }

  // TODO: come up with a better way to identify number columns to align to the right
  if (column.key.toString().match(/^p\d\d/) || column.key === 'total_exclusive_time') {
    return (
      <TextAlignLeft>
        <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />
      </TextAlignLeft>
    );
  }
  if (!['description', 'transaction'].includes(column.key.toString())) {
    return (
      <TextAlignLeft>
        <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>
      </TextAlignLeft>
    );
  }

  return <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>;
}

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

export const TextAlignLeft = styled('span')`
  text-align: left;
  width: 100%;
`;
