import {useMatches} from 'react-router';
import {IconCalendar} from '@sentry/icons/calendar';
import {PlatformIcon} from 'platformicons';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import type {EntityHeaderProps} from '@sentry/scraps/entityHeader';

import {DateTime} from 'sentry/components/dateTime';
import {ReplayLoadingState} from 'sentry/components/replays/player/replayLoadingState';
import {useLiveBadge} from 'sentry/components/replays/replayLiveIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {EventView} from 'sentry/utils/discover/eventView';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useReplayViewers} from 'sentry/utils/replays/hooks/useReplayViewers';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {useLocation} from 'sentry/utils/useLocation';
import {ReplayErrorsTooltip} from 'sentry/views/explore/replays/detail/header/replayErrorsTooltip';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export function ReplayDetailsEntityHeader({readerResult}: Props) {
  const location = useLocation();
  const matches = useMatches();
  const [prefs] = useReplayPrefs();

  const replayRecord = readerResult.replayRecord;
  const viewers = useReplayViewers({replayRecord});
  const {isLive} = useLiveBadge({
    startedAt: replayRecord?.is_archived ? null : (replayRecord?.started_at ?? null),
    finishedAt: replayRecord?.is_archived ? null : (replayRecord?.finished_at ?? null),
  });

  const breadcrumbTab = {
    ...location,
    query: {
      referrer: getRouteStringFromRoutes({matches}),
      ...EventView.fromLocation(location).generateQueryStringObject(),
      t_main: TabKey.BREADCRUMBS,
      f_b_type: 'rageOrDead',
    },
  };

  const errorsTab = {
    ...location,
    query: {...location.query, t_main: TabKey.ERRORS},
  };

  const deadClicks = replayRecord?.count_dead_clicks ?? 0;
  const rageClicks = replayRecord?.count_rage_clicks ?? 0;

  const nonFeedbackErrors = readerResult.errors.filter(
    error => !error.title.includes('User Feedback')
  );

  function buildProps(isLoading: boolean): EntityHeaderProps {
    // The record lands before the attachments and errors do, so the title and
    // metadata can go live while these are still unknown: the error count is
    // not yet fetched, and `isVideoReplay` reads false until the attachments
    // arrive, which would show the click stats on a replay that has none.
    const statsLoading = readerResult.isPending;
    const isVideoReplay = readerResult.replay?.isVideoReplay() ?? false;
    const showDeadRageClicks = statsLoading || !isVideoReplay;

    return {
      isLoading,
      title: {
        // The heading shows who recorded the session, which a sighted reader
        // infers from the avatar beside it.
        label: t('Replay user'),
        value: replayRecord?.user.display_name || t('Anonymous User'),
        leadingGraphic: replayRecord
          ? {
              type: 'user',
              user: {
                username: replayRecord.user?.display_name || '',
                email: replayRecord.user?.email || '',
                id: replayRecord.user?.id || '',
                ip_address: replayRecord.user?.ip || '',
                name: replayRecord.user?.username || '',
              },
            }
          : undefined,
        tags: [
          isLive ? (
            <Tag key="live" variant="success">
              {t('Live')}
            </Tag>
          ) : null,
        ],
      },
      people: {
        users: viewers.users,
        label: t('Viewed by'),
        isLoading: viewers.isPending,
      },
      stats: {
        label: t('Replay stats'),
        items: [
          showDeadRageClicks
            ? {
                type: 'link',
                label: t('Dead Clicks'),
                value: deadClicks,
                to: breadcrumbTab,
                isLoading: statsLoading,
              }
            : null,
          showDeadRageClicks
            ? {
                type: 'link',
                label: t('Rage Clicks'),
                value: rageClicks,
                to: breadcrumbTab,
                isLoading: statsLoading,
              }
            : null,
          {
            type: 'link',
            label: t('Errors'),
            value: nonFeedbackErrors.length,
            to: errorsTab,
            labelTooltip: nonFeedbackErrors.length ? (
              <ReplayErrorsTooltip replayErrors={nonFeedbackErrors} />
            ) : undefined,
            isLoading: statsLoading,
          },
        ],
      },
      metadata: {
        label: t('Replay properties'),
        items: [
          replayRecord && !replayRecord.is_archived
            ? {
                leadingGraphic: <IconCalendar size="md" variant="muted" />,
                label: t('Started at'),
                type: 'text',
                value:
                  prefs.timestampType === 'absolute' ? (
                    <DateTime year timeZone date={replayRecord.started_at} />
                  ) : (
                    <TimeSince date={replayRecord.started_at} />
                  ),
              }
            : null,
          replayRecord?.browser.name
            ? {
                leadingGraphic: (
                  <PlatformIcon
                    platform={generatePlatformIconName(
                      replayRecord.browser.name,
                      replayRecord.browser.version ?? undefined
                    )}
                    size="16px"
                  />
                ),
                label: t('Browser'),
                type: 'text',
                value: replayRecord.browser.name,
                secondary: replayRecord.browser.version
                  ? {label: t('version'), value: replayRecord.browser.version}
                  : undefined,
              }
            : null,
          replayRecord?.os.name
            ? {
                leadingGraphic: (
                  <PlatformIcon
                    platform={generatePlatformIconName(
                      replayRecord.os.name,
                      replayRecord.os.version ?? undefined
                    )}
                    size="16px"
                  />
                ),
                label: t('Operating system'),
                type: 'text',
                value: replayRecord.os.name,
                secondary: replayRecord.os.version
                  ? {label: t('version'), value: replayRecord.os.version}
                  : undefined,
              }
            : null,
        ],
      },
    };
  }

  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => (
        <EntityHeader title={{label: t('Session replay'), value: t('Deleted Replay')}} />
      )}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() => <EntityHeader {...buildProps(!replayRecord)} />}
      renderMissing={() => null}
      renderProcessingError={() => <EntityHeader {...buildProps(false)} />}
    >
      {() => <EntityHeader {...buildProps(false)} />}
    </ReplayLoadingState>
  );
}
