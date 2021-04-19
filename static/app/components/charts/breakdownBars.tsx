import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {formatPercentage} from 'app/utils/formatters';

type Point = {
  label: string;
  value: number;
};

type Props = {
  /**
   * The data to display. The caller should order the points
   * in the order they want bars displayed.
   */
  data: Point[];
};

function BreakdownBars({data}: Props) {
  const total = data.reduce((sum, point) => point.value + sum, 0);
  return (
    <BreakdownGrid>
      {data.map((point, i) => (
        <React.Fragment key={`${i}:${point.label}`}>
          <Percentage>{formatPercentage(point.value / total, 0)}</Percentage>
          <BarContainer>
            <Bar style={{width: `${((point.value / total) * 100).toFixed(2)}%`}} />
            <Label>{point.label}</Label>
          </BarContainer>
        </React.Fragment>
      ))}
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

const BarContainer = styled('div')`
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  position: relative;
`;

const Label = styled('span')`
  position: relative;
  color: ${p => p.theme.textColor};
  z-index: 2;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Bar = styled('div')`
  border-radius: 2px;
  background-color: ${p => p.theme.border};
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  height: 100%;
  width: 0%;
`;
