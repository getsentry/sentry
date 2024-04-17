import type {ReactText} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import FileSize from 'sentry/components/fileSize';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {defined} from 'sentry/utils';
import type {CountUnit, PercentageUnit} from 'sentry/utils/discover/fields';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {
  formatAbbreviatedNumber,
  formatPercentage,
  formatRate,
} from 'sentry/utils/formatters';
import {Block} from 'sentry/views/starfish/views/spanSummaryPage/block';

type Unit =
  | DurationUnit.MILLISECOND
  | SizeUnit.BYTE
  | RateUnit
  | CountUnit
  | PercentageUnit;

interface Props {
  title: string;
  unit: Unit;
  value: ReactText | undefined;
  align?: 'left' | 'right';
  isLoading?: boolean;
  tooltip?: React.ReactNode;
}

export function MetricReadout(props: Props) {
  return (
    <Block title={props.title} alignment={props.align}>
      <ReadoutContent {...props} />
    </Block>
  );
}

function ReadoutContent({unit, value, tooltip, align = 'right', isLoading}: Props) {
  if (isLoading) {
    return (
      <LoadingContainer align={align}>
        <LoadingIndicator mini />
      </LoadingContainer>
    );
  }

  if (!defined(value)) {
    return <Fragment>--</Fragment>;
  }

  let renderedValue: React.ReactNode;

  if (isARateUnit(unit)) {
    renderedValue = (
      <NumberContainer align={align}>
        {formatRate(typeof value === 'string' ? parseFloat(value) : value, unit)}
      </NumberContainer>
    );
  }

  if (unit === DurationUnit.MILLISECOND) {
    // TODO: Implement other durations
    renderedValue = (
      <NumberContainer align={align}>
        <Duration
          seconds={typeof value === 'string' ? parseFloat(value) : value / 1000}
          fixedDigits={2}
          abbreviation
        />
      </NumberContainer>
    );
  }

  if (unit === SizeUnit.BYTE) {
    // TODO: Implement other sizes
    renderedValue = (
      <NumberContainer align={align}>
        <FileSize bytes={typeof value === 'string' ? parseInt(value, 10) : value} />
      </NumberContainer>
    );
  }

  if (unit === 'count') {
    renderedValue = (
      <NumberContainer align={align}>
        {formatAbbreviatedNumber(typeof value === 'string' ? parseInt(value, 10) : value)}
      </NumberContainer>
    );
  }

  if (unit === 'percentage') {
    renderedValue = (
      <NumberContainer align={align}>
        {formatPercentage(typeof value === 'string' ? parseFloat(value) : value)}
      </NumberContainer>
    );
  }

  if (tooltip) {
    return (
      <NumberContainer align={align}>
        <Tooltip title={tooltip} isHoverable showUnderline>
          {renderedValue}
        </Tooltip>
      </NumberContainer>
    );
  }

  return <NumberContainer align={align}>{renderedValue}</NumberContainer>;
}

const NumberContainer = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  font-variant-numeric: tabular-nums;
`;

const LoadingContainer = styled('div')<{align: 'left' | 'right'}>`
  display: flex;
  justify-content: ${p => (p.align === 'right' ? 'flex-end' : 'flex-start')};
  align-items: center;
`;

function isARateUnit(unit: string): unit is RateUnit {
  return (Object.values(RateUnit) as string[]).includes(unit);
}
