import {useEffect, useRef} from 'react';
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
  const {
    releaseProjectId,
    showReleasesDrawer,
    rdChart,
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
  const isRenderedFromClick = useRef(false);
  const {rdChart: _rdChart, ...queryWithoutChart} = location.query;

  useEffect(() => {
    if (showReleasesDrawer !== '1') {
      closeDrawer();
    }
  }, [closeDrawer, showReleasesDrawer]);

  useEffect(() => {
    if (showReleasesDrawer === '1' && release) {
      openDrawer(
        () => <ReleasesDrawerDetails release={release} projectId={releaseProjectId} />,
        {
          shouldCloseOnLocationChange: () => {
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
  }, [
    location.query,
    navigate,
    openDrawer,
    release,
    releaseProjectId,
    showReleasesDrawer,
  ]);

  useEffect(() => {
    if (rdChart) {
      isRenderedFromClick.current = true;

      // `rdChart` is a temp hack so that we can render the charts onClick by
      // passing the render function to openDrawer, while at the same time
      // writing a URL entry that gets ignored by `useReleasesDrawer` due to
      // `rdChart` being present in the URL params. This hook then removes
      // `rdChart` so that on reload, this hook will render the drawer (without
      // chart) due to the URL params. Note that it might be possible (but
      // unprobable?) that this `rdChart` clearing call gets interrupted and
      // the user copies a URL with the param, in which case, the drawer won't
      // open on next load.
      navigate(
        {
          query: queryWithoutChart,
        },
        {replace: true}
      );
    }
  }, [navigate, queryWithoutChart, rdChart]);

  useEffect(() => {
    if (
      showReleasesDrawer === '1' &&
      !rdChart &&
      rdStart &&
      rdEnd &&
      !isRenderedFromClick.current
    ) {
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
          shouldCloseOnLocationChange: () => {
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
  }, [
    location.query,
    navigate,
    openDrawer,
    showReleasesDrawer,
    rdChart,
    rdEnd,
    rdEnv,
    rdProject,
    rdStart,
  ]);
}
