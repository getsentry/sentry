import {useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {IconStar} from 'sentry/icons/iconStar';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useStarQuery} from 'sentry/views/explore/hooks/useStarQuery';

export function StarSavedQueryButton() {
  const location = useLocation();
  const locationId = getIdFromLocation(location);
  const {starQuery} = useStarQuery();
  const {data, isLoading, isFetched} = useGetSavedQuery(locationId);
  const [isStarred, setIsStarred] = useState(data?.starred);

  useEffect(() => {
    if (isFetched) {
      setIsStarred(data?.starred);
    }
  }, [data, isFetched]);

  const debouncedOnClick = useMemo(() => {
    return debounce(
      (id, starred) => {
        if (!id) {
          return;
        }
        try {
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
  }, [starQuery]);

  if (isLoading || !locationId) {
    return null;
  }
  return (
    <Button
      aria-label={isStarred ? t('Unstar') : t('Star')}
      icon={<IconStar isSolid={isStarred} color={isStarred ? 'yellow300' : 'subText'} />}
      size="sm"
      onClick={() => debouncedOnClick(locationId, !isStarred)}
    />
  );
}
