import {useEffect} from 'react';
import {logger} from '@sentry/core';

import {
  EventDrawerBody,
  EventDrawerContainer,
} from 'sentry/components/events/eventDrawer';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ReleasesDrawerDetails} from 'sentry/views/releases/drawer/releasesDrawerDetails';
import {ReleasesDrawerList} from 'sentry/views/releases/drawer/releasesDrawerList';

const RELEASES_DRAWER_FIELD_MAP = {
  rd: decodeScalar,
  rdChart: decodeScalar,
  rdCiCursor: decodeScalar,
  rdEnd: decodeScalar,
  rdEnv: decodeList,
  rdListCursor: decodeScalar,
  rdProject: decodeList,
  rdRelease: decodeScalar,
  rdReleaseProjectId: decodeScalar,
  rdStart: decodeScalar,
};

/**
 * The container for the Releases Drawer. Handles displaying either the
 * releases list or details.
 */
export function ReleasesDrawer() {
  const {rd, rdChart, rdEnd, rdEnv, rdStart, rdProject, rdRelease, rdReleaseProjectId} =
    useLocationQuery({
      fields: RELEASES_DRAWER_FIELD_MAP,
    });
  const start = getDateFromTimestamp(rdStart);
  const end = getDateFromTimestamp(rdEnd);
  const defaultPageFilters = usePageFilters();
  const subPageFilters = {
    projects: Array.isArray(rdProject)
      ? rdProject.map(Number)
      : defaultPageFilters.selection.projects,
    environments: Array.isArray(rdEnv)
      ? rdEnv
      : defaultPageFilters.selection.environments,
    datetime:
      start && end
        ? {
            start,
            end,
            period: null,
            utc: null,
          }
        : defaultPageFilters.selection.datetime,
  };

  useEffect(() => {
    if (rd === 'show' && !rdRelease && !rdStart && !rdEnd) {
      logger.error('Release: Invalid URL parameters for drawer');
    }
  }, [rd, rdRelease, rdStart, rdEnd]);

  if (rd !== 'show') {
    return null;
  }

  if (rdRelease) {
    return <ReleasesDrawerDetails release={rdRelease} projectId={rdReleaseProjectId} />;
  }

  if (start && end) {
    return <ReleasesDrawerList chart={rdChart} subPageFilters={subPageFilters} />;
  }

  return (
    <EventDrawerContainer>
      <EventDrawerBody>
        <LoadingError
          message={t(
            'There was a problem loading the releases drawer due to invalid URL parameters.'
          )}
        />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
