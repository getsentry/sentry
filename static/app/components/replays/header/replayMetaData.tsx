import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorCounts from 'sentry/components/replays/header/errorCounts';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ColorOrAlias} from 'sentry/utils/theme';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord | undefined;
};

function ReplayMetaData({replayErrors, replayRecord}: Props) {
  return (
    <KeyMetrics>
      <KeyMetricLabel>{t('Dead Clicks')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord?.count_dead_clicks ? (
          <ClickCount color="yellow300">
            <IconCursorArrow size="sm" />
            {replayRecord.count_dead_clicks}
          </ClickCount>
        ) : (
          <Count>0</Count>
        )}
      </KeyMetricData>

      <KeyMetricLabel>{t('Rage Clicks')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord?.count_rage_clicks ? (
          <ClickCount color="red300">
            <IconCursorArrow size="sm" />
            {replayRecord.count_rage_clicks}
          </ClickCount>
        ) : (
          <Count>0</Count>
        )}
      </KeyMetricData>

      <KeyMetricLabel>{t('Start Time')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <Fragment>
            <IconCalendar color="gray300" />
            <TimeSince date={replayRecord.started_at} unitStyle="regular" />
          </Fragment>
        ) : (
          <HeaderPlaceholder width="80px" height="16px" />
        )}
      </KeyMetricData>
      <KeyMetricLabel>{t('Errors')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <ErrorCounts replayErrors={replayErrors} replayRecord={replayRecord} />
        ) : (
          <HeaderPlaceholder width="80px" height="16px" />
        )}
      </KeyMetricData>
    </KeyMetrics>
  );
}

const KeyMetrics = styled('dl')`
  display: grid;
  grid-template-rows: max-content 1fr;
  grid-template-columns: repeat(4, max-content);
  grid-auto-flow: column;
  gap: 0 ${space(3)};
  align-items: center;
  align-self: end;
  color: ${p => p.theme.gray300};
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    justify-self: flex-end;
  }
`;

const KeyMetricLabel = styled('dt')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const KeyMetricData = styled('dd')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const Count = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const ClickCount = styled(Count)<{color: ColorOrAlias}>`
  color: ${p => p.theme[p.color]};
  display: flex;
  width: 40px;
  gap: ${space(0.75)};
  align-items: center;
`;

export default ReplayMetaData;
