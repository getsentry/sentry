import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatMetricsUsingUnitAndOp, getNameFromMRI} from 'sentry/utils/metrics';
import {Series} from 'sentry/views/ddm/metricsExplorer';

export function SummaryTable({
  series,
  operation,
  onClick,
}: {
  onClick: (seriesName: string) => void;
  series: Series[];
  operation?: string;
}) {
  return (
    <SummaryTableWrapper>
      <HeaderCell />
      <HeaderCell>{t('Name')}</HeaderCell>
      <HeaderCell>{t('Avg')}</HeaderCell>
      <HeaderCell>{t('Min')}</HeaderCell>
      <HeaderCell>{t('Max')}</HeaderCell>
      <HeaderCell>{t('Sum')}</HeaderCell>

      {series.map(({seriesName, color, hidden, unit, data}) => {
        const {avg, min, max, sum} = getValues(data);

        return (
          <Fragment key={seriesName}>
            <FlexCell onClick={() => onClick(seriesName)} hidden={hidden}>
              <ColorDot color={color} />
            </FlexCell>
            <Cell onClick={() => onClick(seriesName)}>{getNameFromMRI(seriesName)}</Cell>
            {/* TODO(ddm): Add a tooltip with the full value, don't add on click in case users want to copy the value */}
            <Cell>{formatMetricsUsingUnitAndOp(avg, unit, operation)}</Cell>
            <Cell>{formatMetricsUsingUnitAndOp(min, unit, operation)}</Cell>
            <Cell>{formatMetricsUsingUnitAndOp(max, unit, operation)}</Cell>
            <Cell>{formatMetricsUsingUnitAndOp(sum, unit, operation)}</Cell>
          </Fragment>
        );
      })}
    </SummaryTableWrapper>
  );
}

function getValues(seriesData: Series['data']) {
  if (!seriesData) {
    return {min: null, max: null, avg: null, sum: null};
  }

  const res = seriesData.reduce(
    (acc, {value}) => {
      if (value === null) {
        return acc;
      }

      acc.min = Math.min(acc.min, value);
      acc.max = Math.max(acc.max, value);
      acc.sum += value;

      return acc;
    },
    {min: Infinity, max: -Infinity, sum: 0}
  );

  return {...res, avg: res.sum / seriesData.length};
}

// TODO(ddm): PanelTable component proved to be a bit too opinionated for this use case,
// so we're using a custom styled component instead. Figure out what we want to do here
const SummaryTableWrapper = styled(`div`)`
  display: grid;
  grid-template-columns: 0.5fr 8fr 1fr 1fr 1fr 1fr;
`;

// TODO(ddm): This is a copy of PanelTableHeader, try to figure out how to reuse it
const HeaderCell = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  line-height: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;

  padding: ${space(0.5)};
`;

const Cell = styled('div')`
  padding: ${space(0.25)};

  :hover {
    cursor: ${p => (p.onClick ? 'pointer' : 'default')};
  }
`;

const FlexCell = styled(Cell)`
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: ${p => (p.hidden ? 0.5 : 1)};
`;

const ColorDot = styled(`div`)`
  background-color: ${p => p.color};
  border-radius: 50%;
  width: ${space(1)};
  height: ${space(1)};
`;
