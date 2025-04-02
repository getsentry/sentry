import {useEffect} from 'react';
import omit from 'lodash/omit';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ReleasesDrawerDetails} from 'sentry/views/releases/drawer/releasesDrawerDetails';
import {ReleasesDrawerList} from 'sentry/views/releases/drawer/releasesDrawerList';

const RELEASES_DRAWER_FIELD_MAP = {
  showReleasesDrawer: decodeScalar,
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
  const {
    releaseProjectId,
    showReleasesDrawer,
    rdEnd,
    rdEnv,
    rdProject,
    rdStart,
    release,
  } = useLocationQuery({
    fields: RELEASES_DRAWER_FIELD_MAP,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const {closeDrawer, openDrawer} = useDrawer();

  useEffect(() => {
    if (showReleasesDrawer !== '1') {
      closeDrawer();
    } else if (release) {
      openDrawer(
        () => <ReleasesDrawerDetails release={release} projectId={releaseProjectId} />,
        {
          shouldCloseOnLocationChange: newPathName => {
            return false;
          },
          ariaLabel: t('Releases drawer'),
          transitionProps: {stiffness: 1000},
          onClose: () => {
            navigate({
              query: cleanLocationQuery(location.query),
            });
          },
        }
      );
    } else if (rdStart && rdEnd) {
      openDrawer(
        () => (
          <ReleasesDrawerList
            environments={rdEnv}
            projects={rdProject.map(Number)}
            startTs={Number(rdStart)}
            endTs={Number(rdEnd)}
          />
        ),
        {
          shouldCloseOnLocationChange: newPathName => {
            return false;
          },
          ariaLabel: t('Releases drawer'),
          transitionProps: {stiffness: 1000},
          onClose: () => {
            navigate({
              query: cleanLocationQuery(location.query),
            });
          },
        }
      );
    }

    return () => {
      closeDrawer();
    };
  }, [
    closeDrawer,
    openDrawer,
    location.query,
    navigate,
    rdEnd,
    rdEnv,
    rdProject,
    rdStart,
    release,
    releaseProjectId,
    showReleasesDrawer,
  ]);
}
