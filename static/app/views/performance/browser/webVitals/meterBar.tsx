import {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';

export function MeterBar({
  minWidth,
  meterItems,
  row,
  total,
  meterText,
}: {
  meterItems: string[];
  minWidth: number;
  row: any;
  total: number;
  meterText?: ReactNode;
}) {
  const theme = useTheme();
  const widths: number[] = [];
  meterItems.reduce((acc, item, index) => {
    const width = Math.max(
      Math.min(
        (100 * row[item]) / total - acc,
        100 - acc - minWidth * (meterItems.length - index)
      ),
      minWidth
    );

    widths.push(width);
    return acc + width;
  }, 0);

  const color =
    widths[0] > 90 ? theme.green300 : widths[0] > 50 ? theme.yellow300 : theme.red300;
  return (
    <span>
      <MeterText>
        {meterText ?? `${getDuration(row[meterItems[0]] / 1000, 0, true, true)}`}
      </MeterText>
      <MeterContainer width={100}>
        <Meter width={widths[0]} color={color} />
      </MeterContainer>
    </span>
  );
}

const MeterContainer = styled('span')<{width: number}>`
  display: flex;
  width: ${p => p.width}%;
  height: ${space(1)};
  background-color: ${p => p.theme.gray100};
  margin-bottom: 4px;
`;

const Meter = styled('span')<{
  color: string;
  width: number;
}>`
  display: block;
  width: ${p => p.width}%;
  height: 100%;
  background-color: ${p => p.color};
`;
const MeterText = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray300};
  white-space: nowrap;
`;
