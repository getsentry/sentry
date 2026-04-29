import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {useDrawer} from '@sentry/scraps/drawer';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {
  cleanLocationQuery,
  RELEASES_DRAWER_FIELD_MAP,
  ReleasesDrawerFields,
} from './utils';

export function useReleasesDrawer() {
  const {rd} = useLocationQuery({
    fields: RELEASES_DRAWER_FIELD_MAP,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const {openDrawer} = useDrawer();
  // Dynamically import the ReleasesDrawer component to avoid unnecessary bundle size + circular deps with version & versionHoverCard components
  const {data: ReleasesDrawer, isPending} = useQuery({
    queryKey: ['ReleasesDrawerComponent'],
    queryFn: async () => {
      return (await import('sentry/views/explore/releases/drawer/releasesDrawer'))
        .ReleasesDrawer;
    },
  });

  useEffect(() => {
    if (rd === 'show') {
      openDrawer(
        () => (!isPending && ReleasesDrawer ? <ReleasesDrawer /> : <LoadingIndicator />),
        {
          shouldCloseOnLocationChange: nextLocation => {
            return nextLocation.query[ReleasesDrawerFields.DRAWER] !== 'show';
          },
          ariaLabel: t('Releases drawer'),
          drawerKey: 'releases-drawer',
          onClose: () => {
            navigate({
              query: cleanLocationQuery(location.query),
            });
          },
        }
      );
    }
  }, [rd, location.query, navigate, openDrawer, ReleasesDrawer, isPending]);
}
