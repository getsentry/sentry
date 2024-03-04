import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import FileSize from 'sentry/components/fileSize';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {defined} from 'sentry/utils';
import type {CountUnit} from 'sentry/utils/discover/fields';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber, formatRate} from 'sentry/utils/formatters';
import {Block} from 'sentry/views/starfish/views/spanSummaryPage/block';

// TODO: Implement percentage units
// TODO: Implement percentage change units
// TODO: Implement string units
type Unit = DurationUnit | SizeUnit | RateUnit | CountUnit;

interface Props {
  title: string;
  unit: Unit;
  value: number | undefined;
  align?: 'left' | 'right';
  isLoading?: boolean;
  tooltip?: React.ReactNode;
}

export function MetricReadout({
  unit,
  value,
  title,
  tooltip,
  align = 'right',
  isLoading,
}: Props) {
  return (
    <Block title={title} alignment={align}>
      {(() => {
        if (isLoading) {
          return <LoadingIndicator mini />;
        }

        if (!defined(value)) {
          return '--';
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
              {formatAbbreviatedNumber(
                typeof value === 'string' ? parseInt(value, 10) : value
              )}
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
      })()}
    </Block>
  );
}

const NumberContainer = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  font-variant-numeric: tabular-nums;
`;

function isARateUnit(unit: string): unit is RateUnit {
  return (Object.values(RateUnit) as string[]).includes(unit);
}
