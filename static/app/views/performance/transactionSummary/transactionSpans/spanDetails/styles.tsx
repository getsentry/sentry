import styled from '@emotion/styled';

import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';

import {PerformanceDuration} from '../../../utils';

const DurationBar = styled('div')`
  position: relative;
  display: flex;
  top: ${space(0.5)};
  background-color: ${p => p.theme.gray100};
`;

const DurationBarSection = styled(RowRectangle)`
  position: relative;
  width: 100%;
  top: 0;
`;

type SpanDurationBarProps = {
  spanOp: string;
  spanDuration: number;
  transactionDuration: number;
};

export function SpanDurationBar(props: SpanDurationBarProps) {
  const {spanOp, spanDuration, transactionDuration} = props;
  const widthPercentage = spanDuration / transactionDuration;
  const position = widthPercentage < 0.7 ? 'right' : 'inset';

  return (
    <DurationBar>
      <div style={{width: toPercent(widthPercentage)}}>
        <Tooltip title={formatPercentage(widthPercentage)} containerDisplayMode="block">
          <DurationBarSection
            spanBarHatch={false}
            style={{backgroundColor: pickBarColor(spanOp)}}
          >
            <DurationPill
              durationDisplay={position}
              showDetail={false}
              spanBarHatch={false}
            >
              <PerformanceDuration abbreviation milliseconds={spanDuration} />
            </DurationPill>
          </DurationBarSection>
        </Tooltip>
      </div>
    </DurationBar>
  );
}

export const SpanLabelContainer = styled('div')`
  ${overflowEllipsis};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

export const emptyValue = <EmptyValueContainer>{t('n/a')}</EmptyValueContainer>;
