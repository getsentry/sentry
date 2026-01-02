import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import Placeholder from 'sentry/components/placeholder';
import ErrorCounts from 'sentry/components/replays/header/errorCounts';
import ReplayViewers from 'sentry/components/replays/header/replayViewers';
import {IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {RawReplayError} from 'sentry/utils/replays/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  replayErrors: RawReplayError[];
  replayRecord: ReplayRecord;
  showDeadRageClicks?: boolean;
}

export default function ReplayMetaData({
  replayErrors,
  replayRecord,
  showDeadRageClicks = true,
}: Props) {
  const nonFeedbackErrors = replayErrors.filter(e => !e.title.includes('User Feedback'));

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
                  <IconCursorArrow size="sm" variant="danger" />
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
          replayRecord.is_archived ? null : (
            <ErrorCounts replayErrors={nonFeedbackErrors} />
          )
        ) : (
          <Placeholder width="20px" height="16px" />
        )}
      </KeyMetricData>
      <KeyMetricLabel>{t('Seen By')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          replayRecord.is_archived ? null : (
            <ReplayViewers
              projectId={replayRecord.project_id}
              replayId={replayRecord.id}
            />
          )
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
  color: ${p => p.theme.subText};
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    justify-self: flex-end;
  }
`;

const KeyMetricLabel = styled('dt')`
  font-size: ${p => p.theme.fontSize.md};
`;

const KeyMetricData = styled('dd')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.normal};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const Count = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const ClickCount = styled(Count)`
  color: ${p => p.theme.subText};
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
`;
