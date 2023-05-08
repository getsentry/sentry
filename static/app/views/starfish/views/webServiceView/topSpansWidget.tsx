import styled from '@emotion/styled';
import {Link} from 'react-router';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';
import {getTopSpansInModule} from 'sentry/views/starfish/views/webServiceView/queries';

type Props = {
  module?: string;
};

const COLUMN_ORDER = [
  {
    key: 'description',
    name: 'Span',
    width: 550,
  },
  {
    key: 'cumulative_time',
    name: 'Cumulative Time',
    width: 100,
  },
];

export default function TopSpansWidget({module}: Props) {
  const location = useLocation();
  const {isLoading: isTopSpansDataLoading, data: topSpansData} = useQuery({
    queryKey: ['topSpans', module],
    queryFn: () =>
      fetch(`${HOST}/?query=${getTopSpansInModule(module)}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  if (!isTopSpansDataLoading) {
    console.dir(topSpansData);
  }

  return (
    <GridEditable
      isLoading={isTopSpansDataLoading}
      data={topSpansData}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: (column: GridColumnHeader, row: EndpointDataRow) =>
          renderBodyCell(column, row, console.dir),
      }}
      location={location}
    />
  );
}

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  if (column.key === 'description') {
    return (
      <TextAlignLeft>
        <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
      </TextAlignLeft>
    );
  }

  return (
    <TextAlignRight>
      <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
    </TextAlignRight>
  );
}

function renderBodyCell(
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

  return <TextAlignRight>{row[column.key]}</TextAlignRight>;
}

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

export const TextAlignRight = styled('span')`
  text-align: right;
  width: 100%;
`;

export const TextAlignLeft = styled('span')`
  text-align: left;
  width: 100%;
`;
