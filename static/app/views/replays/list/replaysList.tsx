import {Fragment, useMemo} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import {tct} from 'sentry/locale';
import type {
  Organization,
  Project,
  ProjectSdkUpdates,
  UpdateSdkSuggestion,
} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {semverCompare} from 'sentry/utils/profiling/units/versions';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import withSdkUpdates from 'sentry/utils/withSdkUpdates';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

function ReplaysList() {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: REPLAY_LIST_FIELDS,
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location]);

  const hasSessionReplay = organization.features.includes('session-replay');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  return hasSessionReplay && !fetching && hasSentOneReplay ? (
    <ReplaysListTable
      eventView={eventView}
      location={location}
      organization={organization}
    />
  ) : (
    <ReplayOnboardingPanel />
  );
}

function ReplaysListTable({
  eventView,
  location,
  organization,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
}) {
  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  return (
    <Fragment>
      <ReplayTableAlert />
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={eventView.sorts[0]}
        visibleColumns={[
          ReplayColumns.replay,
          ReplayColumns.os,
          ReplayColumns.browser,
          ReplayColumns.duration,
          ReplayColumns.countErrors,
          ReplayColumns.activity,
        ]}
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          trackAdvancedAnalyticsEvent('replay.list-paginated', {
            organization,
            direction: cursor?.endsWith(':1') ? 'prev' : 'next',
          });
          browserHistory.push({
            pathname: path,
            query: {...searchQuery, cursor},
          });
        }}
      />
    </Fragment>
  );
}

interface ReplayTableAlertProps {
  sdkUpdates?: ProjectSdkUpdates[] | null;
}

const MIN_REPLAY_CLICK_SDK = '7.44.0';

const ReplayTableAlert = withSdkUpdates(function ReplayTableAlert({
  sdkUpdates,
}: ReplayTableAlertProps) {
  const {selection} = usePageFilters();
  const projects = useProjects();
  const location = useLocation();
  const conditions = useMemo(() => {
    return new MutableSearch(decodeScalar(location.query.query, ''));
  }, [location.query]);

  const hasReplayClick = conditions.getFilterKeys().some(k => k.includes('replay_click'));

  if (!hasReplayClick) {
    return null;
  }

  const selectedProjectsWithSdkUpdates = sdkUpdates?.reduce((acc, sdkUpdate) => {
    if (!selection.projects.includes(Number(sdkUpdate.projectId))) {
      return acc;
    }

    const project = projects.projects.find(p => p.id === sdkUpdate.projectId);
    // should never really happen but making ts happy
    if (!project) {
      return acc;
    }

    acc.push({
      project,
      sdkUpdate,
    });

    return acc;
  }, [] as Array<{project: Project; sdkUpdate: ProjectSdkUpdates}>);

  const doesNotMeetMinSDK =
    selectedProjectsWithSdkUpdates &&
    selectedProjectsWithSdkUpdates.length > 0 &&
    selectedProjectsWithSdkUpdates.every(({sdkUpdate}) => {
      return semverCompare(sdkUpdate.sdkVersion, MIN_REPLAY_CLICK_SDK) === -1;
    });

  if (!doesNotMeetMinSDK) {
    return null;
  }

  const sdkUpdateAction = selectedProjectsWithSdkUpdates?.[0]?.sdkUpdate.suggestions.find(
    suggestion => suggestion.type === 'updateSdk'
  ) as UpdateSdkSuggestion | undefined;

  if (sdkUpdateAction) {
    return (
      <Alert>
        {tct(
          'Searching by replay_click requires a minimum SDK version of [sdkName]@v[minSdkVersion]. [action]',
          {
            sdkName: sdkUpdateAction.sdkName,
            newSdkVersion: sdkUpdateAction.newSdkVersion,
            minSdkVersion: MIN_REPLAY_CLICK_SDK,
            action: sdkUpdateAction.sdkUrl ? (
              <ExternalLink href={sdkUpdateAction.sdkUrl}>
                {tct('Update to [sdkName]@v[newSdkVersion]', {
                  sdkName: sdkUpdateAction.sdkName,
                  newSdkVersion: sdkUpdateAction.newSdkVersion,
                })}
              </ExternalLink>
            ) : (
              tct('Update to [sdkName]@v[newSdkVersion]', {
                sdkName: sdkUpdateAction.sdkName,
                newSdkVersion: sdkUpdateAction.newSdkVersion,
              })
            ),
          }
        )}
      </Alert>
    );
  }

  return (
    <Alert>
      {tct(
        'Searching by replay_click requires a minimum SDK version of v[minSdkVersion].',
        {
          minSdkVersion: MIN_REPLAY_CLICK_SDK,
        }
      )}
    </Alert>
  );
});

export default ReplaysList;
