import {useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
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
  const [isStarred, setIsStarred] = useState(data?.starred);

  useEffect(() => {
    if (isFetched) {
      // oxlint-disable-next-line react/set-state-in-effect
      setIsStarred(data?.starred);
    }
  }, [data, isFetched]);

  const debouncedToggle = useMemo(() => {
    return debounce(
      (id: string | undefined, starred: boolean) => {
        if (!id) {
          return;
        }
        try {
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
          starQuery(parseInt(id, 10), starred);
          setIsStarred(starred);
        } catch (error) {
          Sentry.captureException(error);
          addErrorMessage(t('Failed to star query'));
          setIsStarred(!starred);
        }
      },
      1000,
      {leading: true}
    );
  }, [starQuery, organization, analytics]);

  return {
    isLoading,
    isStarred: Boolean(isStarred),
    toggleStar: () => debouncedToggle(savedQueryId, !isStarred),
  };
}
