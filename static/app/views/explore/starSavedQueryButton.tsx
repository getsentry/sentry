import {useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {IconStar} from 'sentry/icons/iconStar';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getSavedQueryTraceItemDataset,
  useGetSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useStarQuery} from 'sentry/views/explore/hooks/useStarQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function StarSavedQueryButton() {
  const organization = useOrganization();
  const location = useLocation();
  const locationId = decodeScalar(location.query.id);
  const {starQuery} = useStarQuery();
  const {data, isLoading, isFetched} = useGetSavedQuery(locationId);
  const [isStarred, setIsStarred] = useState(data?.starred);

  useEffect(() => {
    if (isFetched) {
      // oxlint-disable-next-line react/set-state-in-effect
      setIsStarred(data?.starred);
    }
  }, [data, isFetched]);

  // Keyed on the dataset rather than the whole query: starring invalidates the
  // query, and a new `data` object would rebuild the debounce and drop its
  // one-second guard.
  const dataset = data?.dataset;

  const debouncedOnClick = useMemo(() => {
    return debounce(
      (id, starred) => {
        if (!id) {
          return;
        }
        try {
          if (dataset) {
            if (getSavedQueryTraceItemDataset(dataset) === TraceItemDataset.SPANS) {
              trackAnalytics('trace_explorer.star_query', {
                save_type: starred ? 'star_query' : 'unstar_query',
                ui_source: 'explorer',
                organization,
              });
            } else if (getSavedQueryTraceItemDataset(dataset) === TraceItemDataset.LOGS) {
              trackAnalytics('logs.star_query', {
                save_type: starred ? 'star_query' : 'unstar_query',
                ui_source: 'explorer',
                organization,
              });
            }
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
  }, [starQuery, organization, dataset]);

  if (isLoading || !locationId) {
    return null;
  }

  const label = isStarred ? t('Unstar') : t('Star');

  return (
    <Button
      tooltipProps={{title: label}}
      aria-label={label}
      icon={<IconStar isSolid={isStarred} variant={isStarred ? 'warning' : 'muted'} />}
      size="sm"
      onClick={() => debouncedOnClick(locationId, !isStarred)}
    />
  );
}
