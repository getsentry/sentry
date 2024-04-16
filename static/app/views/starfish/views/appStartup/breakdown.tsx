import styled from '@emotion/styled';

import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import toPercent from 'sentry/utils/number/toPercent';
import toRoundedPercent from 'sentry/utils/number/toRoundedPercent';

interface Row {
  [index: string]: number | undefined;
}

interface BreakdownGroup {
  color: string;
  key: string;
  name: string;
}

export function TooltipContents({
  row,
  total,
  breakdownGroups,
}: {
  breakdownGroups: BreakdownGroup[];
  row: Row;
  total: number;
}) {
  return (
    <TooltipContentWrapper data-test-id="breakdown-tooltip-content">
      {breakdownGroups.map(({key, color, name}) => (
        <StartupType key={key}>
          <StartupNameContainer>
            <StartupDot style={{backgroundColor: color}} />
            <StartupName>{name}</StartupName>
          </StartupNameContainer>
          <StartupCount>{row[key] ?? 0}</StartupCount>
          {toRoundedPercent((row[key] ?? 0) / total)}
        </StartupType>
      ))}
    </TooltipContentWrapper>
  );
}

function Breakdown({
  row,
  breakdownGroups,
  ['data-test-id']: dataTestId,
}: {
  breakdownGroups: BreakdownGroup[];
  row: Row;
  ['data-test-id']?: string;
}) {
  const total = breakdownGroups.reduce((acc, {key}) => acc + (row?.[key] ?? 0), 0);

  if (total === 0) {
    return null;
  }

  return (
    <Tooltip
      title={
        <TooltipContents row={row} total={total} breakdownGroups={breakdownGroups} />
      }
    >
      <RelativeOpsBreakdown data-test-id={dataTestId}>
        {breakdownGroups.map(({key, color}) => (
          <div
            key={key}
            style={{
              width: toPercent((row[key] ?? 0) / total),
            }}
          >
            <RectangleRelativeOpsBreakdown
              style={{
                backgroundColor: color,
              }}
            />
          </div>
        ))}
      </RelativeOpsBreakdown>
    </Tooltip>
  );
}

export default Breakdown;

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
  gap: ${space(2)};
`;

const StartupCount = styled('div')`
  color: ${p => p.theme.gray300};
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
