import type {ReactText} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import FileSize from 'sentry/components/fileSize';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PercentChange, type Polarity} from 'sentry/components/percentChange';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {
  type CountUnit,
  CurrencyUnit,
  DurationUnit,
  type PercentageUnit,
  type PercentChangeUnit,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber, formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

type Unit =
  | DurationUnit.MILLISECOND
  | SizeUnit.BYTE
  | RateUnit
  | CountUnit
  | PercentageUnit
  | PercentChangeUnit
  | CurrencyUnit;

interface Props {
  title: string;
  unit: Unit;
  value: ReactText | undefined;
  isLoading?: boolean;
  preferredPolarity?: Polarity;
  tooltip?: React.ReactNode;
}

export function MetricReadout(props: Props) {
  return (
    <ReadoutWrapper>
      <ReadoutTitle alignment={'left'}>{props.title}</ReadoutTitle>
      <ReadoutContentWrapper alignment={'left'}>
        <ReadoutContent {...props} />
      </ReadoutContentWrapper>
    </ReadoutWrapper>
  );
}

function ReadoutContent({unit, value, tooltip, isLoading, preferredPolarity}: Props) {
  if (isLoading) {
    return (
      <LoadingContainer align="left">
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
      <NumberContainer align="left">
        {formatRate(typeof value === 'string' ? parseFloat(value) : value, unit, {
          minimumValue: MINIMUM_RATE_VALUE,
        })}
      </NumberContainer>
    );
  }

  if (unit === DurationUnit.MILLISECOND) {
    // TODO: Implement other durations
    renderedValue = (
      <NumberContainer align="left">
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
      <NumberContainer align="left">
        <FileSize bytes={typeof value === 'string' ? parseInt(value, 10) : value} />
      </NumberContainer>
    );
  }

  if (unit === 'count') {
    renderedValue = (
      <NumberContainer align="left">
        {formatAbbreviatedNumber(typeof value === 'string' ? parseInt(value, 10) : value)}
      </NumberContainer>
    );
  }

  if (unit === CurrencyUnit.USD) {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numericValue <= 1) {
      renderedValue = (
        <NumberContainer align="left">US ${numericValue.toFixed(3)}</NumberContainer>
      );
    } else {
      renderedValue = (
        <NumberContainer align="left">
          US ${formatAbbreviatedNumber(numericValue)}
        </NumberContainer>
      );
    }
  }

  if (unit === 'percentage') {
    renderedValue = (
      <NumberContainer align="left">
        {formatPercentage(
          typeof value === 'string' ? parseFloat(value) : value,
          undefined,
          {minimumValue: MINIMUM_PERCENTAGE_VALUE}
        )}
      </NumberContainer>
    );
  }

  if (unit === 'percent_change') {
    renderedValue = (
      <NumberContainer align="left">
        <PercentChange
          value={typeof value === 'string' ? parseFloat(value) : value}
          minimumValue={MINIMUM_PERCENTAGE_VALUE}
          preferredPolarity={preferredPolarity}
        />
      </NumberContainer>
    );
  }

  if (tooltip) {
    return (
      <NumberContainer align="left">
        <Tooltip title={tooltip} isHoverable showUnderline>
          {renderedValue}
        </Tooltip>
      </NumberContainer>
    );
  }

  return <NumberContainer align="left">{renderedValue}</NumberContainer>;
}

const MINIMUM_RATE_VALUE = 0.01;
const MINIMUM_PERCENTAGE_VALUE = 0.0001; // 0.01%

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

const ReadoutWrapper = styled('div')`
  flex-grow: 0;
  min-width: 0;
  word-break: break-word;
`;

const ReadoutTitle = styled('h3')<{alignment: 'left' | 'right'}>`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  white-space: nowrap;
  height: ${space(3)};
  text-align: ${p => p.alignment};
`;

const ReadoutContentWrapper = styled('h4')<{alignment: 'left' | 'right'}>`
  margin: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-align: ${p => p.alignment};
`;
