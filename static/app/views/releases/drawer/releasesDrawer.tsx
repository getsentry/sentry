import {useEffect} from 'react';
import {logger} from '@sentry/core';

import AnalyticsArea from 'sentry/components/analyticsArea';
import type {ChartId} from 'sentry/components/charts/chartWidgetLoader';
import {
  EventDrawerBody,
  EventDrawerContainer,
} from 'sentry/components/events/eventDrawer';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ReleasesDrawerDetails} from 'sentry/views/releases/drawer/releasesDrawerDetails';
import {ReleasesDrawerList} from 'sentry/views/releases/drawer/releasesDrawerList';

import {RELEASES_DRAWER_FIELD_MAP} from './utils';

/**
 * The container for the Releases Drawer. Handles displaying either the
 * releases list or details.
 */
export function ReleasesDrawer() {
  const {
    rd,
    rdChart,
    rdEnd,
    rdEnv,
    rdEvent,
    rdSource,
    rdStart,
    rdProject,
    rdRelease,
    rdReleaseProjectId,
  } = useLocationQuery({
    fields: RELEASES_DRAWER_FIELD_MAP,
  });
  const start = getDateFromTimestamp(rdStart);
  const end = getDateFromTimestamp(rdEnd);
  const defaultPageFilters = usePageFilters();
  const organization = useOrganization();
  const pageFilters = {
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
    if (rd === 'show' && organization) {
      trackAnalytics('releases.drawer_opened', {
        release: Boolean(rdRelease),
        organization: organization.id,
        source: rdChart ?? rdSource ?? 'unknown',
      });
    }
  }, [organization, rd, rdProject, rdRelease, rdSource, rdChart]);

  useEffect(() => {
    if (rd === 'show' && !rdRelease && !rdStart && !rdEnd) {
      logger.error('Release: Invalid URL parameters for drawer');
    }
  }, [rd, rdRelease, rdStart, rdEnd]);

  if (rd !== 'show') {
    return null;
  }

  if (rdRelease) {
    return (
      <AnalyticsArea name="releases-drawer-details">
        <ReleasesDrawerDetails
          release={rdRelease}
          projectId={rdReleaseProjectId}
          start={start}
          end={end}
        />
      </AnalyticsArea>
    );
  }

  if (start && end) {
    return (
      <AnalyticsArea name="releases-drawer-list">
        <ReleasesDrawerList
          chart={rdChart as ChartId}
          pageFilters={pageFilters}
          eventId={rdEvent}
        />
      </AnalyticsArea>
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
