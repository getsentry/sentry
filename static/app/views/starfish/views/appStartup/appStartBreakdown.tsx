import styled from '@emotion/styled';

import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toPercent from 'sentry/utils/number/toPercent';
import toRoundedPercent from 'sentry/utils/number/toRoundedPercent';

export const COLD_START_COLOR = '#F58C46';
export const WARM_START_COLOR = '#F2B712';

interface Row {
  'count_starts(measurements.app_start_cold)': number;
  'count_starts(measurements.app_start_warm)': number;
}

function TooltipContents({
  row,
  total,
  coldStartKey,
  warmStartKey,
}: {
  coldStartKey: string;
  row: Row;
  total: number;
  warmStartKey: string;
}) {
  return (
    <TooltipContentWrapper>
      <StartupType>
        <StartupNameContainer>
          <StartupDot style={{backgroundColor: COLD_START_COLOR}} />
          <StartupName>{t('Cold Start')}</StartupName>
        </StartupNameContainer>
        {toRoundedPercent(row[coldStartKey] / total)}
      </StartupType>
      <StartupType>
        <StartupNameContainer>
          <StartupDot style={{backgroundColor: WARM_START_COLOR}} />
          <StartupName>{t('Warm Start')}</StartupName>
        </StartupNameContainer>
        {toRoundedPercent(row[warmStartKey] / total)}
      </StartupType>
    </TooltipContentWrapper>
  );
}

function AppStartBreakdown({
  row,
  coldStartKey = 'count_starts(measurements.app_start_cold)',
  warmStartKey = 'count_starts(measurements.app_start_warm)',
}: {
  row: Row;
  coldStartKey?: string;
  warmStartKey?: string;
}) {
  const total = row[coldStartKey] + row[warmStartKey];

  if (total === 0) {
    return null;
  }
  return (
    <Tooltip
      title={
        <TooltipContents
          row={row}
          total={total}
          coldStartKey={coldStartKey}
          warmStartKey={warmStartKey}
        />
      }
    >
      <RelativeOpsBreakdown>
        <div
          key="cold-start"
          style={{
            width: toPercent(row[coldStartKey] / total),
          }}
        >
          <RectangleRelativeOpsBreakdown
            style={{
              backgroundColor: COLD_START_COLOR,
            }}
          />
        </div>
        <div
          key="warm-start"
          style={{
            width: toPercent(row[warmStartKey] / total),
          }}
        >
          <RectangleRelativeOpsBreakdown
            style={{
              backgroundColor: WARM_START_COLOR,
            }}
          />
        </div>
      </RelativeOpsBreakdown>
    </Tooltip>
  );
}

export default AppStartBreakdown;

const RelativeOpsBreakdown = styled('div')`
  position: relative;
  display: flex;
`;

const RectangleRelativeOpsBreakdown = styled(RowRectangle)`
  position: relative;
  width: 100%;
`;

const StartupDot = styled('div')`
  content: '';
  display: block;
  width: 8px;
  min-width: 8px;
  height: 8px;
  margin-right: ${space(1)};
  border-radius: 100%;
`;

const OpsContent = styled('div')`
  display: flex;
  align-items: center;
`;

const StartupNameContainer = styled(OpsContent)`
  overflow: hidden;
`;

const StartupType = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(4)};
`;

const StartupName = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TooltipContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
