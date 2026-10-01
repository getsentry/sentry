import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useGetSavedQuery,
  useInvalidateSavedQuery,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useStarQuery} from 'sentry/views/explore/hooks/useStarQuery';

interface UseStarSavedQueryResult {
  isLoading: boolean;
  isStarred: boolean;
  toggleStar: () => void;
}

export function useStarSavedQuery({
  savedQueryId,
  analytics,
}: {
  /** Analytics family for the surface, or null where no events are registered. */
  analytics: 'trace_explorer' | 'logs' | 'conversations' | null;
  savedQueryId?: string;
}): UseStarSavedQueryResult {
  const organization = useOrganization();
  const {starQuery} = useStarQuery();
  const {data, isLoading, isFetched} = useGetSavedQuery(savedQueryId);
  const invalidateSavedQuery = useInvalidateSavedQuery(savedQueryId);
  const [isStarred, setIsStarred] = useState(data?.starred);

  useEffect(() => {
    if (isFetched) {
      // oxlint-disable-next-line react/set-state-in-effect
      setIsStarred(data?.starred);
    }
  }, [data, isFetched]);

  const toggle = useCallback(
    (savedQuery: SavedQuery | undefined, starred: boolean) => {
      if (!savedQuery) {
        return;
      }
      if (analytics === 'trace_explorer') {
        trackAnalytics('trace_explorer.star_query', {
          save_type: starred ? 'star_query' : 'unstar_query',
          ui_source: 'explorer',
          organization,
        });
      } else if (analytics === 'logs') {
        trackAnalytics('logs.star_query', {
          save_type: starred ? 'star_query' : 'unstar_query',
          ui_source: 'explorer',
          organization,
        });
      }

      setIsStarred(starred);
      starQuery(savedQuery, starred)
        .then(() => {
          // `useStarQuery` invalidates the saved query *list* but not the
          // individual query, so `savedQuery.starred` would stay stale.
          // Duplicate posts that value, and the create endpoint honours it,
          // so a copy would inherit the pre-toggle star state.
          invalidateSavedQuery();
        })
        .catch(error => {
          Sentry.captureException(error);
          addErrorMessage(t('Failed to star query'));
          setIsStarred(!starred);
        });
    },
    [starQuery, organization, analytics, invalidateSavedQuery]
  );

  return {
    isLoading,
    isStarred: Boolean(isStarred),
    toggleStar: () => toggle(data, !isStarred),
  };
}
