import {Fragment} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import ErrorCounts from 'sentry/components/replays/header/errorCounts';
import ReplayViewers from 'sentry/components/replays/header/replayViewers';
import {IconCursorArrow} from 'sentry/icons';
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
  isLoading?: boolean;
  showDeadRageClicks?: boolean;
};

function ReplayMetaData({
  replayErrors,
  replayRecord,
  showDeadRageClicks = true,
  isLoading,
}: Props) {
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

  return isLoading ? (
    <Placeholder height="47px" width="203px" />
  ) : (
    <KeyMetrics>
      {showDeadRageClicks && (
        <Fragment>
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
        </Fragment>
      )}

      {showDeadRageClicks && (
        <Fragment>
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
        </Fragment>
      )}

      <KeyMetricLabel>{t('Errors')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <ErrorCounts replayErrors={replayErrors} replayRecord={replayRecord} />
        ) : (
          <Placeholder width="20px" height="16px" />
        )}
      </KeyMetricData>
      <KeyMetricLabel>{t('Seen By')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <ReplayViewers projectId={replayRecord.project_id} replayId={replayRecord.id} />
        ) : (
          <Placeholder width="55px" height="27px" />
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
  font-weight: ${p => p.theme.fontWeightNormal};
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

export default ReplayMetaData;
