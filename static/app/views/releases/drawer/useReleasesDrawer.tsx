import {useEffect} from 'react';
import omit from 'lodash/omit';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ReleasesDrawer} from 'sentry/views/releases/drawer/releasesDrawer';

const RELEASES_DRAWER_FIELD_MAP = {
  rd: decodeScalar,
  rdChart: decodeScalar,
  rdEnd: decodeScalar,
  rdStart: decodeScalar,
  rdEnv: decodeList,
  rdProject: decodeList,
  release: decodeScalar,
  releaseProjectId: decodeScalar,
};
const RELEASES_DRAWER_FIELDS = Object.keys(RELEASES_DRAWER_FIELD_MAP);

function cleanLocationQuery(query: Record<string, string[] | string | null | undefined>) {
  return omit(query, RELEASES_DRAWER_FIELDS);
}

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
          return nextLocation.query.rd !== 'show';
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
