import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';

type Point = {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
  tooltip?: string;
};

type Props = {
  /**
   * The data to display. The caller should order the points
   * in the order they want bars displayed.
   */
  data: Point[];
  maxItems?: number;
};

function BreakdownBars({data, maxItems}: Props) {
  const total = data.reduce((sum, point) => point.value + sum, 0);
  return (
    <BreakdownGrid>
      {(maxItems ? data.slice(0, maxItems) : data).map((point, i) => {
        const bar = (
          <Fragment>
            <Bar
              style={{width: `${((point.value / total) * 100).toFixed(2)}%`}}
              active={point.active}
            />
            <Label>{point.label}</Label>
          </Fragment>
        );
        return (
          <Fragment key={`${i}:${point.label}`}>
            <Percentage>{formatPercentage(point.value / total, 0)}</Percentage>
            <BarContainer
              data-test-id={`status-${point.label}`}
              cursor={point.onClick ? 'pointer' : 'default'}
              onClick={point.onClick}
            >
              {point.tooltip ? <Tooltip title={point.tooltip}>{bar}</Tooltip> : bar}
            </BarContainer>
          </Fragment>
        );
      })}
    </BreakdownGrid>
  );
}

export default BreakdownBars;

const BreakdownGrid = styled('div')`
  display: grid;
  grid-template-columns: min-content auto;
  column-gap: ${space(1)};
  row-gap: ${space(1)};
`;

const Percentage = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  text-align: right;
`;

const BarContainer = styled('div')<{cursor: 'pointer' | 'default'}>`
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  position: relative;
  cursor: ${p => p.cursor};
  display: flex;
  align-items: center;
`;

const Label = styled('span')`
  position: relative;
  color: ${p => p.theme.textColor};
  z-index: 2;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Bar = styled('div')<{active?: boolean}>`
  border-radius: 2px;
  background-color: ${p => (p.active ? p.theme.purple200 : p.theme.border)};
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  height: 100%;
  width: 0%;
`;
