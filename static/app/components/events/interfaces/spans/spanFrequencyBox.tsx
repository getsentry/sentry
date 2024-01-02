import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {
  AggregateSpanType,
  GapSpanType,
} from 'sentry/components/events/interfaces/spans/types';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';

export const FREQUENCY_BOX_WIDTH = 40;

type Props = {
  span: AggregateSpanType | GapSpanType;
};

// Colors are copied from tagsHeatMap.tsx, as they are not available on the theme
const purples = ['#D1BAFC', '#9282F3', '#6056BA', '#313087', '#021156'];

export function SpanFrequencyBox({span}: Props) {
  if (span.type === 'gap') {
    return (
      <StyledBox>
        <Tooltip isHoverable title={t('This frequency of this span is unknown')}>
          {'—'}
        </Tooltip>
      </StyledBox>
    );
  }

  const {frequency, count, total} = span;
  return (
    <StyledBox frequency={frequency ?? 0}>
      <Tooltip
        isHoverable
        title={tct('This span occurred in [x] out of [total] events aggregated', {
          x: count,
          total,
        })}
      >
        {formatPercentage(frequency ?? 0, 0)}
      </Tooltip>
    </StyledBox>
  );
}

function getBoxColors(theme: Theme, frequency?: number) {
  if (!frequency || frequency >= 0.9) {
    return `
      background: ${purples[3]};
      color: ${theme.white};
    `;
  }

  if (frequency >= 0.7) {
    return `
      background: ${purples[2]};
      color: ${theme.white};
    `;
  }

  if (frequency >= 0.5) {
    return `
      background: ${purples[1]};
      color: ${theme.black};
    `;
  }

  if (frequency >= 0.3) {
    return `
      background: ${purples[0]};
      color: ${theme.black};
    `;
  }

  return `
      background: ${theme.white};
      color: ${theme.black};
    `;
}

const StyledBox = styled('div')<{frequency?: number}>`
  display: flex;
  justify-content: right;
  align-items: center;

  height: 100%;
  width: ${FREQUENCY_BOX_WIDTH}px;

  border-left: 1px solid ${p => p.theme.gray200};
  border-right: 1px solid ${p => p.theme.gray200};
  padding-right: ${space(1)};

  font-size: ${p => p.theme.fontSizeExtraSmall};
  ${p => getBoxColors(p.theme, p.frequency)}

  z-index: 9;
`;
