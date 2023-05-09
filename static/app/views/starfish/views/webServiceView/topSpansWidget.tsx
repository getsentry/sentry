import {Fragment} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleSegment} from 'sentry/views/starfish/components/breakdownBar';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';
import {ModuleBreakdownChart} from 'sentry/views/starfish/views/webServiceView/moduleBreakdownChart';
import {getTopSpansInModule} from 'sentry/views/starfish/views/webServiceView/queries';

type Props = {
  moduleSegment: ModuleSegment;
};

const COLUMN_ORDER = [
  {
    key: 'span',
    name: 'Span',
    width: 700,
  },
  {
    key: 'cumulative_time',
    name: 'Cumulative Time',
    width: 100,
  },
];

export default function TopSpansWidget({moduleSegment}: Props) {
  const location = useLocation();
  const {module, sum: totalModuleTime} = moduleSegment;
  const {isLoading: isTopSpansDataLoading, data: topSpansData} = useQuery({
    queryKey: ['topSpans', module],
    queryFn: () =>
      fetch(`${HOST}/?query=${getTopSpansInModule(module)}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (column.key === 'span' || column.key === 'cumulative_time') {
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
    if (column.key === 'span' && onSelect) {
      return (
        <OverflowEllipsisTextContainer>
          <Link onClick={() => onSelect(row)} to="">
            {row[column.key]}
          </Link>
        </OverflowEllipsisTextContainer>
      );
    }

    if (column.key === 'cumulative_time') {
      return (
        <PercentageBar module={module} value={row[column.key]} max={totalModuleTime} />
      );
    }

    return <TextAlignRight>{row[column.key]}</TextAlignRight>;
  }

  const topSpans = topSpansData.map(
    // Quotes have to be escaped or the query won't work
    ({span}) => `'${span.replaceAll(/'/g, "\\'").replaceAll(/"/g, '\\"')}'`
  );

  return (
    <Fragment>
      <ModuleBreakdownChart topSpans={topSpans} />
      <GridEditable
        isLoading={isTopSpansDataLoading}
        data={topSpansData}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell: (column: GridColumnHeader, row: EndpointDataRow) =>
            renderBodyCell(column, row, () => {}),
        }}
        location={location}
      />
    </Fragment>
  );
}

function PercentageBar({
  module,
  value,
  max,
}: {
  max: number;
  module: string;
  value: number;
}) {
  const percentage = Math.round((value / max) * 100);
  return (
    <Tooltip
      title={tct(
        'This span accounts for [percentage]% of all time spent on [module] spans in your web service',
        {
          percentage,
          module,
        }
      )}
    >
      <BarContainer>
        <Bar percentage={percentage} />
      </BarContainer>
    </Tooltip>
  );
}

const BarContainer = styled('div')`
  background: ${p => p.theme.blue100};
`;

const Bar = styled('div')<{percentage: number}>`
  height: ${space(2)};
  background: ${p => p.theme.blue400};
  width: ${p => p.percentage}%;
`;

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
