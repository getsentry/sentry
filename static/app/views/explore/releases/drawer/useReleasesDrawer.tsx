import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useQueryStates} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';

import {RELEASES_DRAWER_PARSERS, ReleasesDrawerFields} from './utils';

export function useReleasesDrawer() {
  const [{rd}, setDrawerQuery] = useQueryStates(RELEASES_DRAWER_PARSERS);
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
            void setDrawerQuery(null, {history: 'replace'});
          },
        }
      );
    }
  }, [rd, openDrawer, ReleasesDrawer, isPending, setDrawerQuery]);
}
