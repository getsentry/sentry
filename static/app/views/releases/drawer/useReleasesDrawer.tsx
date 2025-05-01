import {useEffect} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ReleasesDrawer} from 'sentry/views/releases/drawer/releasesDrawer';

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

  useEffect(() => {
    if (rd === 'show') {
      openDrawer(() => <ReleasesDrawer />, {
        shouldCloseOnLocationChange: nextLocation => {
          return nextLocation.query[ReleasesDrawerFields.DRAWER] !== 'show';
        },
        ariaLabel: t('Releases drawer'),
        transitionProps: {stiffness: 1000},
        onClose: () => {
          navigate({
            query: cleanLocationQuery(location.query),
          });
        },
      });
    }
  }, [rd, location.query, navigate, openDrawer]);
}
