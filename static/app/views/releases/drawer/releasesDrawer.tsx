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
import {ReleasesDrawerDetails} from 'sentry/views/releases/drawer/releasesDrawerDetails';
import {ReleasesDrawerList} from 'sentry/views/releases/drawer/releasesDrawerList';

const RELEASES_DRAWER_FIELD_MAP = {
  rd: decodeScalar,
  rdChart: decodeScalar,
  rdEnd: decodeScalar,
  rdStart: decodeScalar,
  rdEnv: decodeList,
  rdProject: decodeList,
  rdRelease: decodeScalar,
  rdReleaseProjectId: decodeScalar,
};

/**
 * The container for the Releases Drawer. Handles displaying either the
 * releases list or details.
 */
export function ReleasesDrawer() {
  const {rd, rdEnd, rdEnv, rdStart, rdProject, rdRelease, rdReleaseProjectId} =
    useLocationQuery({
      fields: RELEASES_DRAWER_FIELD_MAP,
    });
  const start = getDateFromTimestamp(rdStart);
  const end = getDateFromTimestamp(rdEnd);

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
    return (
      <ReleasesDrawerList
        environments={rdEnv}
        projects={rdProject.map(Number)}
        start={start}
        end={end}
      />
    );
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
