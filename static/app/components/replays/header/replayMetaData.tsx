import {Link} from 'react-router';
import styled from '@emotion/styled';

import ErrorCounts from 'sentry/components/replays/header/errorCounts';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord | undefined;
};

function ReplayMetaData({replayErrors, replayRecord}: Props) {
  const location = useLocation();
  const routes = useRoutes();
  const referrer = getRouteStringFromRoutes(routes);
  const eventView = EventView.fromLocation(location);

  const breadcrumbTab = {
    ...location,
    query: {
      referrer,
      ...eventView.generateQueryStringObject(),
      t_main: TabKey.BREADCRUMBS,
      f_b_type: 'rageOrDead',
    },
  };

  return (
    <KeyMetrics>
      <KeyMetricLabel>{t('Start Time')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <TimeContainer>
            <IconCalendar color="gray300" size="sm" />
            <TimeSince
              date={replayRecord.started_at}
              isTooltipHoverable
              unitStyle="regular"
            />
          </TimeContainer>
        ) : (
          <HeaderPlaceholder width="80px" height="16px" />
        )}
      </KeyMetricData>

      <KeyMetricLabel>{t('Dead Clicks')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord?.count_dead_clicks ? (
          <Link to={breadcrumbTab}>
            <ClickCount>
              <IconCursorArrow size="sm" color="yellow300" />
              {replayRecord.count_dead_clicks}
            </ClickCount>
          </Link>
        ) : (
          <Count>0</Count>
        )}
      </KeyMetricData>

      <KeyMetricLabel>{t('Rage Clicks')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord?.count_rage_clicks ? (
          <Link to={breadcrumbTab}>
            <ClickCount>
              <IconCursorArrow size="sm" color="red300" />
              {replayRecord.count_rage_clicks}
            </ClickCount>
          </Link>
        ) : (
          <Count>0</Count>
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
  grid-template-columns: repeat(5, max-content);
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

const ClickCount = styled(Count)`
  color: ${p => p.theme.gray300};
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
`;

const TimeContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

export default ReplayMetaData;
